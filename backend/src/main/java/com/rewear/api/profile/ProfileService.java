package com.rewear.api.profile;

import java.util.Map;
import java.util.Arrays;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.rewear.api.profile.ProfileDtos.CreateRequest;
import com.rewear.api.profile.ProfileDtos.ProfileResponse;
import com.rewear.api.profile.ProfileDtos.UpdateRequest;

@Service
public class ProfileService {
    private final NamedParameterJdbcTemplate jdbc;
    private final java.util.Set<String> adminEmails;

    public ProfileService(NamedParameterJdbcTemplate jdbc, @Value("${rewear.admin.emails:}") String configuredAdminEmails) {
        this.jdbc = jdbc;
        this.adminEmails = Arrays.stream(configuredAdminEmails.split(",")).map(String::trim)
            .map(String::toLowerCase).filter(value -> !value.isBlank()).collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    @Transactional
    public ProfileResponse create(Jwt jwt, CreateRequest request) {
        UUID id = userId(jwt);
        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The signed-in account has no verified email address.");
        }

        AccountRole role = adminEmails.contains(email.trim().toLowerCase()) ? AccountRole.ADMIN : AccountRole.from(request.role());
        MapSqlParameterSource parameters = new MapSqlParameterSource()
            .addValue("id", id)
            .addValue("role", role.value())
            .addValue("name", request.name().trim())
            .addValue("email", email.trim().toLowerCase())
            .addValue("phone", clean(request.phone()))
            .addValue("location", request.location().trim());

        int inserted = jdbc.update("""
            INSERT INTO profiles (id, role, name, email, phone, location)
            VALUES (:id, :role, :name, :email, :phone, :location)
            ON CONFLICT (id) DO NOTHING
            """, parameters);

        if (inserted == 0) {
            ProfileResponse existing = get(id);
            if (!existing.role().equals(role.value())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This account already has a different account type.");
            }
            return existing;
        }

        if (role == AccountRole.BUSINESS) {
            String businessName = clean(request.businessName());
            if (businessName == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add a business or store name.");
            }
            jdbc.update("INSERT INTO businesses (profile_id, business_name) VALUES (:id, :businessName)",
                Map.of("id", id, "businessName", businessName));
        }
        return get(id);
    }

    public ProfileResponse get(Jwt jwt) {
        UUID id = userId(jwt);
        String verifiedEmail = clean(jwt.getClaimAsString("email"));
        if (verifiedEmail != null) {
            jdbc.update("UPDATE profiles SET email = :email, updated_at = now() WHERE id = :id",
                Map.of("email", verifiedEmail.toLowerCase(), "id", id));
            if (adminEmails.contains(verifiedEmail.toLowerCase())) {
                jdbc.update("UPDATE profiles SET role = 'admin', updated_at = now() WHERE id = :id", Map.of("id", id));
            }
        }
        ProfileResponse profile = get(id);
        if ("suspended".equals(profile.accountStatus()) && !"admin".equals(profile.role())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This ReWear account is currently suspended.");
        }
        return profile;
    }

    @Transactional
    public ProfileResponse update(Jwt jwt, UpdateRequest request) {
        UUID id = userId(jwt);
        MapSqlParameterSource parameters = new MapSqlParameterSource()
            .addValue("id", id)
            .addValue("name", clean(request.name()))
            .addValue("phone", clean(request.phone()))
            .addValue("location", clean(request.location()))
            .addValue("businessName", clean(request.businessName()));

        int changed = jdbc.update("""
            UPDATE profiles SET
                name = COALESCE(:name, name),
                phone = CASE WHEN :phone IS NULL THEN phone ELSE :phone END,
                location = COALESCE(:location, location),
                updated_at = now()
            WHERE id = :id
            """, parameters);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Create your ReWear profile first.");

        if (request.businessName() != null || request.about() != null) {
            String businessName = clean(request.businessName());
            if (request.businessName() != null && businessName == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Business name cannot be empty.");
            }
            parameters.addValue("businessName", businessName)
                .addValue("about", request.about() == null ? null : request.about().trim());
            int businessChanged = jdbc.update("""
                UPDATE businesses SET business_name = COALESCE(:businessName, business_name),
                    about = CASE WHEN :about IS NULL THEN about ELSE :about END, updated_at = now()
                WHERE profile_id = :id
                """, parameters);
            if (businessChanged == 0) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only a business account can update a store name.");
        }
        return get(id);
    }

    public boolean exists(UUID id) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM profiles WHERE id = :id", Map.of("id", id), Integer.class);
        return count != null && count > 0;
    }

    private ProfileResponse get(UUID id) {
        try {
            return jdbc.queryForObject("""
                SELECT p.id, p.role, p.name, p.email, p.phone, p.location,
                       b.business_name, b.about, b.plan_id,
                       CASE WHEN b.membership_status = 'active' AND b.current_period_end <= now() THEN 'expired' ELSE b.membership_status END AS membership_status,
                       p.account_status
                FROM profiles p
                LEFT JOIN businesses b ON b.profile_id = p.id
                WHERE p.id = :id
                """, Map.of("id", id), (row, number) -> new ProfileResponse(
                    row.getString("id"), row.getString("role"), row.getString("name"),
                    row.getString("email"), row.getString("phone"), row.getString("location"),
                    row.getString("business_name"), row.getString("about"), row.getString("plan_id"), row.getString("membership_status"), row.getString("account_status")));
        } catch (EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Create your ReWear profile first.");
        }
    }

    public static UUID userId(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The authentication token has an invalid user id.");
        }
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim();
        return cleaned.isEmpty() ? null : cleaned;
    }
}
