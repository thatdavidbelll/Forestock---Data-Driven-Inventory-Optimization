package com.forestock.forestock_backend.controller;

import com.forestock.forestock_backend.dto.request.ChangePasswordRequest;
import com.forestock.forestock_backend.dto.request.CreateUserInviteRequest;
import com.forestock.forestock_backend.dto.request.CreateUserRequest;
import com.forestock.forestock_backend.dto.request.UpdateUserRequest;
import com.forestock.forestock_backend.dto.response.ApiResponse;
import com.forestock.forestock_backend.dto.response.CurrentUserDto;
import com.forestock.forestock_backend.dto.response.UserInviteDto;
import com.forestock.forestock_backend.dto.response.UserDto;
import com.forestock.forestock_backend.service.UserInviteService;
import com.forestock.forestock_backend.service.UserManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * User management endpoints.
 *
 * GET/POST/PUT/DELETE /api/users  — restricted to ROLE_ADMIN (enforced in SecurityConfig)
 * PUT /api/users/me/password      — any authenticated user
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserManagementService userManagementService;
    private final UserInviteService userInviteService;

    /** List all users in the current store. */
    @GetMapping
    public ResponseEntity<ApiResponse<List<UserDto>>> listUsers() {
        return ResponseEntity.ok(ApiResponse.success(userManagementService.listUsers()));
    }

    /** Create a new user in the current store (ROLE_MANAGER or ROLE_VIEWER only). */
    @PostMapping
    public ResponseEntity<ApiResponse<UserDto>> createUser(@Valid @RequestBody CreateUserRequest request) {
        try {
            UserDto created = userManagementService.createUser(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("User created", created));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/invite")
    public ResponseEntity<ApiResponse<UserInviteDto>> inviteUser(@Valid @RequestBody CreateUserInviteRequest request) {
        try {
            UserInviteDto invite = userInviteService.createInvite(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Invite sent", invite));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/invites")
    public ResponseEntity<ApiResponse<List<UserInviteDto>>> listInvites() {
        return ResponseEntity.ok(ApiResponse.success(userInviteService.listInvites()));
    }

    @DeleteMapping("/invites/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteInvite(@PathVariable UUID id) {
        try {
            userInviteService.deleteInvite(id);
            return ResponseEntity.ok(ApiResponse.success("Invite deleted", null));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Update role or active status of a user in the current store. */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<UserDto>> updateUser(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateUserRequest request) {
        try {
            UserDto updated = userManagementService.updateUser(id, request);
            return ResponseEntity.ok(ApiResponse.success("User updated", updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Soft-deactivate a user in the current store. */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deactivateUser(@PathVariable UUID id) {
        try {
            userManagementService.deactivateUser(id);
            return ResponseEntity.ok(ApiResponse.success("User deactivated", null));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Change the currently authenticated user's own password. */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<CurrentUserDto>> getCurrentUser() {
        return ResponseEntity.ok(ApiResponse.success(userManagementService.getCurrentUser()));
    }

    @PutMapping("/me/password")
    public ResponseEntity<ApiResponse<Void>> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        try {
            userManagementService.changePassword(request);
            return ResponseEntity.ok(ApiResponse.success("Password changed successfully", null));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Export the current authenticated user's profile and store data as a ZIP archive. */
    @GetMapping("/me/export")
    public ResponseEntity<byte[]> exportMyData() {
        try {
            byte[] zip = userManagementService.exportMyData();
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"forestock-data-export.zip\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(zip);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }
}
