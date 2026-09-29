package com.rewear.api.profile;

public enum AccountRole {
    PERSONAL("personal"),
    BUSINESS("business"),
    ADMIN("admin");

    private final String value;

    AccountRole(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static AccountRole from(String value) {
        if (value == null) throw new IllegalArgumentException("Choose a personal or business account.");
        return switch (value.trim().toLowerCase()) {
            case "personal" -> PERSONAL;
            case "business" -> BUSINESS;
            default -> throw new IllegalArgumentException("Choose a personal or business account.");
        };
    }
}
