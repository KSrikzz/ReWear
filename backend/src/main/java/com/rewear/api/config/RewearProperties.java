package com.rewear.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "rewear")
public record RewearProperties(String frontendOrigin, String openAiApiKey, String openAiModel) {}
