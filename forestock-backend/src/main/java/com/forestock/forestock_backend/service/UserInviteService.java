package com.forestock.forestock_backend.service;

import com.forestock.forestock_backend.domain.AppUser;
import com.forestock.forestock_backend.domain.Store;
import com.forestock.forestock_backend.domain.UserInvite;
import com.forestock.forestock_backend.dto.request.AcceptInviteRequest;
import com.forestock.forestock_backend.dto.request.CreateUserInviteRequest;
import com.forestock.forestock_backend.dto.response.InviteVerificationDto;
import com.forestock.forestock_backend.dto.response.UserInviteDto;
import com.forestock.forestock_backend.repository.AppUserRepository;
import com.forestock.forestock_backend.repository.StoreRepository;
import com.forestock.forestock_backend.repository.UserInviteRepository;
import com.forestock.forestock_backend.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserInviteService {

    private static final int INVITE_EXPIRY_HOURS = 72;

    private final UserInviteRepository userInviteRepository;
    private final AppUserRepository appUserRepository;
    private final StoreRepository storeRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final JavaMailSender mailSender;

    @Value("${forestock.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${forestock.mail.from:noreply@forestock.app}")
    private String fromAddress;

    @Transactional
    public UserInviteDto createInvite(CreateUserInviteRequest request) {
        UUID storeId = requireStoreContext();
        if (appUserRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email is already in use: " + request.getEmail());
        }
        if (userInviteRepository.existsByStoreIdAndEmailAndAcceptedAtIsNull(storeId, request.getEmail().trim())) {
            throw new IllegalArgumentException("An active invite already exists for " + request.getEmail());
        }

        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new NoSuchElementException("Store not found"));

        UserInvite invite = userInviteRepository.save(UserInvite.builder()
                .store(store)
                .email(request.getEmail().trim())
                .role(request.getRole())
                .inviteToken(UUID.randomUUID().toString())
                .invitedBy(SecurityContextHolder.getContext().getAuthentication().getName())
                .expiresAt(LocalDateTime.now().plusHours(INVITE_EXPIRY_HOURS))
                .build());

        sendInviteEmail(invite);
        auditLogService.log("USER_INVITED", "UserInvite", invite.getId().toString(),
                "Invited " + invite.getEmail() + " as " + invite.getRole());
        return toDto(invite);
    }

    @Transactional(readOnly = true)
    public List<UserInviteDto> listInvites() {
        UUID storeId = requireStoreContext();
        return userInviteRepository.findByStoreIdOrderByCreatedAtDesc(storeId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public void deleteInvite(UUID id) {
        UUID storeId = requireStoreContext();
        UserInvite invite = userInviteRepository.findByIdAndStoreId(id, storeId)
                .orElseThrow(() -> new NoSuchElementException("Invite not found"));
        userInviteRepository.delete(invite);
        auditLogService.log("USER_INVITE_DELETED", "UserInvite", invite.getId().toString(),
                "Deleted invite for " + invite.getEmail());
    }

    @Transactional(readOnly = true)
    public InviteVerificationDto verifyInvite(String token) {
        UserInvite invite = loadActiveInvite(token);
        return InviteVerificationDto.builder()
                .email(invite.getEmail())
                .role(invite.getRole())
                .storeName(invite.getStore().getName())
                .expiresAt(invite.getExpiresAt())
                .valid(true)
                .build();
    }

    @Transactional
    public void acceptInvite(AcceptInviteRequest request) {
        UserInvite invite = loadActiveInvite(request.getToken());

        if (appUserRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already taken: " + request.getUsername());
        }
        if (appUserRepository.existsByEmail(invite.getEmail())) {
            throw new IllegalArgumentException("Email is already in use: " + invite.getEmail());
        }

        AppUser user = appUserRepository.save(AppUser.builder()
                .username(request.getUsername().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(invite.getRole())
                .email(invite.getEmail())
                .provisioningSource("INVITE")
                .standaloneAccessEnabled(true)
                .standaloneAccessActivatedAt(LocalDateTime.now())
                .emailVerified(true)
                .store(invite.getStore())
                .active(true)
                .build());

        invite.setAcceptedAt(LocalDateTime.now());
        userInviteRepository.save(invite);

        auditLogService.log("USER_INVITE_ACCEPTED", "UserInvite", invite.getId().toString(),
                "Invite accepted for " + invite.getEmail() + " with username " + user.getUsername());
    }

    private UserInvite loadActiveInvite(String token) {
        UserInvite invite = userInviteRepository.findByInviteToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid invite token."));
        if (invite.getAcceptedAt() != null) {
            throw new IllegalArgumentException("This invite has already been accepted.");
        }
        if (LocalDateTime.now().isAfter(invite.getExpiresAt())) {
            throw new IllegalArgumentException("Invite has expired.");
        }
        return invite;
    }

    private UUID requireStoreContext() {
        UUID storeId = TenantContext.getStoreId();
        if (storeId == null) throw new IllegalStateException("No store context");
        return storeId;
    }

    private UserInviteDto toDto(UserInvite invite) {
        return UserInviteDto.builder()
                .id(invite.getId())
                .email(invite.getEmail())
                .role(invite.getRole())
                .invitedBy(invite.getInvitedBy())
                .expiresAt(invite.getExpiresAt())
                .acceptedAt(invite.getAcceptedAt())
                .createdAt(invite.getCreatedAt())
                .build();
    }

    private void sendInviteEmail(UserInvite invite) {
        String link = frontendUrl + "/accept-invite?token=" + invite.getInviteToken();
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(invite.getEmail());
            message.setSubject("Forestock — You're invited");
            message.setText("""
                    You have been invited to join %s on Forestock as %s.

                    Accept your invite here within %d hours:
                    %s

                    If you weren't expecting this invite, you can ignore this email.
                    """.formatted(invite.getStore().getName(), invite.getRole(), INVITE_EXPIRY_HOURS, link));
            mailSender.send(message);
            log.info("Invite email sent to {}", invite.getEmail());
        } catch (Exception e) {
            log.warn("Failed to send invite email to {}. Invite link (DEV ONLY): {}", invite.getEmail(), link);
            log.warn("Email error: {}", e.getMessage());
        }
    }
}
