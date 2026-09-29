package com.rewear.api.membership;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.rewear.api.profile.ProfileDtos.ProfileResponse;
import com.rewear.api.profile.ProfileService;
import com.rewear.api.config.FinancialProperties;

@Service
public class MembershipService {
    private final NamedParameterJdbcTemplate jdbc;
    private final ProfileService profiles;
    private final FinancialProperties finances;

    public MembershipService(NamedParameterJdbcTemplate jdbc, ProfileService profiles, FinancialProperties finances) {
        this.jdbc = jdbc;
        this.profiles = profiles;
        this.finances = finances;
    }

    public List<Map<String, Object>> plans() {
        return List.of(
            Map.of("id", "silver", "name", "Silver", "monthlyPrice", finances.silverMonthlyPrice(),
                "priceLabel", "₹" + finances.silverMonthlyPrice().toPlainString() + " / month",
                "listingFeePercent", finances.silverListingFeePercent().multiply(java.math.BigDecimal.valueOf(100)),
                "protectionLevel", "STANDARD", "description", "A practical membership for growing business wardrobes.",
                "features", List.of("Standard platform fee", "Standard rental protection", "Basic business analytics")),
            Map.of("id", "gold", "name", "Gold", "monthlyPrice", finances.goldMonthlyPrice(),
                "priceLabel", "₹" + finances.goldMonthlyPrice().toPlainString() + " / month",
                "listingFeePercent", finances.goldListingFeePercent().multiply(java.math.BigDecimal.valueOf(100)),
                "protectionLevel", "PREMIUM", "description", "Advanced tools for established clothing businesses.",
                "features", List.of("Reduced platform fee", "Premium rental protection", "Advanced business analytics"))
        );
    }

    public Map<String, Object> mine(Jwt jwt) {
        ProfileResponse profile = requireBusiness(jwt);
        return jdbc.queryForMap("""
            SELECT plan_id AS "planId", membership_status AS status,
                   provider_subscription_id AS "providerSubscriptionId", current_period_end AS "currentPeriodEnd"
            FROM businesses WHERE profile_id = :id
            """, Map.of("id", UUID.fromString(profile.id())));
    }

    @Transactional
    public Map<String, Object> select(Jwt jwt, String planId) {
        ProfileResponse profile = requireBusiness(jwt);
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Membership changes require completing checkout.");
    }

    private ProfileResponse requireBusiness(Jwt jwt) {
        ProfileResponse profile = profiles.get(jwt);
        if (!"business".equals(profile.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Business membership is available to business accounts.");
        }
        return profile;
    }
}
