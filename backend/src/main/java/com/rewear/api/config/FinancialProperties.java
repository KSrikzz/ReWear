package com.rewear.api.config;

import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "rewear.finance")
public record FinancialProperties(
    String currency,
    BigDecimal personalListingFeePercent,
    BigDecimal personalOrderCommissionPercent,
    BigDecimal silverMonthlyPrice,
    BigDecimal goldMonthlyPrice,
    BigDecimal silverListingFeePercent,
    BigDecimal goldListingFeePercent,
    BigDecimal protectionBaseRatePercent,
    BigDecimal protectionMinPremium,
    BigDecimal protectionMaxPremium,
    int standardClaimWindowHours,
    int highValueClaimWindowHours,
    BigDecimal highValueThreshold,
    boolean highValueProtectionRequired,
    BigDecimal standardCoverageLimit,
    BigDecimal highValueCoverageLimit
) {
    public FinancialProperties {
        currency = currency == null || currency.isBlank() ? "INR" : currency;
        requireRate(personalListingFeePercent, "personal listing fee");
        requireRate(personalOrderCommissionPercent, "personal order commission");
        requireRate(silverListingFeePercent, "Silver listing fee");
        requireRate(goldListingFeePercent, "Gold listing fee");
        requireRate(protectionBaseRatePercent, "protection rate");
        if (silverMonthlyPrice == null || goldMonthlyPrice == null || protectionMinPremium == null || protectionMaxPremium == null
            || highValueThreshold == null || standardCoverageLimit == null || highValueCoverageLimit == null
            || silverMonthlyPrice.signum() < 0 || goldMonthlyPrice.signum() < 0
            || protectionMinPremium.signum() < 0 || protectionMaxPremium.compareTo(protectionMinPremium) < 0
            || standardClaimWindowHours < 1 || highValueClaimWindowHours < 1) {
            throw new IllegalArgumentException("ReWear financial settings are invalid.");
        }
    }

    private static void requireRate(BigDecimal value, String label) {
        if (value == null || value.signum() < 0 || value.compareTo(BigDecimal.ONE) > 0) {
            throw new IllegalArgumentException("The " + label + " rate must be between 0 and 1.");
        }
    }
}
