package com.forestock.forestock_backend;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Full context integration test — requires a running PostgreSQL and AWS credentials.
 * Run manually or in CI with a real test DB.
 */
@SpringBootTest
@Disabled("Requires live DB and AWS credentials — run manually in integration test phase")
class ForestockBackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
