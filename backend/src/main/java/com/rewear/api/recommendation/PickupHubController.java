package com.rewear.api.recommendation;

import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/locations")
public class PickupHubController {
    private final NamedParameterJdbcTemplate jdbc;

    public PickupHubController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/hubs")
    public List<Map<String, Object>> hubs(@RequestParam(required = false) String city) {
        if (city == null || city.isBlank()) {
            return jdbc.queryForList("""
                SELECT id, name, public_area AS area, city, postcode,
                       public_latitude AS "approximateLatitude", public_longitude AS "approximateLongitude"
                FROM pickup_hubs WHERE active = true ORDER BY city, public_area, name
                """, Map.of());
        }
        return jdbc.queryForList("""
            SELECT id, name, public_area AS area, city, postcode,
                   public_latitude AS "approximateLatitude", public_longitude AS "approximateLongitude"
            FROM pickup_hubs WHERE active = true AND city ILIKE :city ORDER BY public_area, name
            """, Map.of("city", city.trim()));
    }
}
