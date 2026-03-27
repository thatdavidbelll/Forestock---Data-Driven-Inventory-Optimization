package com.forestock.forestock_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling   // required for DailyForecastJob @Scheduled
@EnableAsync        // required for ForecastOrchestrator @Async
public class ForestockBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(ForestockBackendApplication.class, args);
	}

}
