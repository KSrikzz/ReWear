package com.rewear.api.commission;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.rewear.api.profile.ProfileDtos.ProfileResponse;
import com.rewear.api.profile.ProfileService;
import com.rewear.api.config.FinancialProperties;

@Service
public class CommissionService {
    private final NamedParameterJdbcTemplate jdbc;
    private final ProfileService profiles;
    private final FinancialProperties properties;

    public CommissionService(NamedParameterJdbcTemplate jdbc, ProfileService profiles, FinancialProperties properties) {
        this.jdbc = jdbc;
        this.profiles = profiles;
        this.properties = properties;
    }

    public Map<String, Object> policy(Jwt jwt) {
        ProfileResponse profile = profiles.get(jwt);
        BigDecimal rate = "business".equals(profile.role()) ? rateForOwner(UUID.fromString(profile.id()), "business") : properties.personalOrderCommissionPercent();
        return Map.of("rate", rate, "percent", rate.multiply(BigDecimal.valueOf(100)));
    }

    public BigDecimal rateForOwner(UUID ownerId, String ownerType) {
        if ("personal".equals(ownerType)) return properties.personalOrderCommissionPercent();
        if (!"business".equals(ownerType)) return BigDecimal.ZERO;
        String plan = jdbc.queryForList("SELECT plan_id FROM businesses WHERE profile_id = :id AND membership_status = 'active' AND current_period_end > now()",
            Map.of("id", ownerId), String.class).stream().findFirst().orElse("silver");
        return "gold".equals(plan) ? properties.goldListingFeePercent() : properties.silverListingFeePercent();
    }

    public List<Map<String, Object>> mine(Jwt jwt) {
        ProfileResponse profile = profiles.get(jwt);
        if (!List.of("personal", "business").contains(profile.role())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Commission history is available to wardrobe providers.");
        UUID ownerId = UUID.fromString(profile.id());
        return jdbc.queryForList("""
            SELECT l.id, l.booking_id AS "bookingId", l.currency, l.gross_amount AS gross,
                   l.commission_rate AS "commissionRate", l.commission_amount AS fee,
                   l.owner_net_amount AS "ownerNet", l.status, l.created_at AS "createdAt"
            FROM commission_ledger l WHERE l.owner_id = :ownerId ORDER BY l.created_at DESC
            """, Map.of("ownerId", ownerId));
    }
}
