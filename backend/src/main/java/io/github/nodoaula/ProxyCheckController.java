package io.github.nodoaula;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * TEMPORAL — verifica cómo se comporta la reescritura de Render como proxy
 * (tarea 75 de AB#6). Se elimina en cuanto los resultados queden anotados.
 */
@RestController
@RequestMapping("/api/proxy-check")
class ProxyCheckController {

    private static final Logger log = LoggerFactory.getLogger(ProxyCheckController.class);

    @GetMapping
    ResponseEntity<Map<String, Object>> get(HttpServletRequest request) {
        return describe("GET", null, request);
    }

    @PostMapping
    ResponseEntity<Map<String, Object>> post(@RequestBody(required = false) Map<String, Object> body,
                                             HttpServletRequest request) {
        return describe("POST", body, request);
    }

    @PutMapping
    ResponseEntity<Map<String, Object>> put(@RequestBody(required = false) Map<String, Object> body,
                                            HttpServletRequest request) {
        return describe("PUT", body, request);
    }

    @DeleteMapping
    ResponseEntity<Map<String, Object>> delete(@RequestBody(required = false) Map<String, Object> body,
                                               HttpServletRequest request) {
        return describe("DELETE", body, request);
    }

    private ResponseEntity<Map<String, Object>> describe(String method,
                                                         Map<String, Object> body,
                                                         HttpServletRequest request) {
        Map<String, String> headers = new TreeMap<>();
        request.getHeaderNames().asIterator()
               .forEachRemaining(name -> headers.put(name, request.getHeader(name)));

        log.info("proxy-check {} scheme={} headers={} body={}",
                 method, request.getScheme(), headers, body);

        ResponseCookie cookie = ResponseCookie.from("proxy_check", "ok")
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(300)
                .build();

        Map<String, Object> response = new HashMap<>();
        response.put("method", method);
        response.put("bodyReceived", body);
        response.put("cookieReceived", request.getHeader("Cookie"));
        response.put("xForwardedProto", request.getHeader("X-Forwarded-Proto"));
        response.put("xForwardedFor", request.getHeader("X-Forwarded-For"));
        response.put("schemeSeenBySpring", request.getScheme());
        response.put("headers", headers);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(response);
    }
}
