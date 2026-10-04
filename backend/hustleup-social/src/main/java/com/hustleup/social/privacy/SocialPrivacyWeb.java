package com.hustleup.social.privacy;

import com.hustleup.social.dto.PostDto;
import com.hustleup.social.dto.StoryDto;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.MethodParameter;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.*;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.*;
import org.springframework.web.servlet.config.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;
import jakarta.servlet.http.*;
import java.util.*;

@Configuration @RestControllerAdvice @RequiredArgsConstructor
public class SocialPrivacyWeb implements WebMvcConfigurer, ResponseBodyAdvice<Object> {
    private final SocialPrivacyGuard guard;
    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                @SuppressWarnings("unchecked")
                Map<String,String> vars = (Map<String,String>) request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
                if (vars == null) return true;
                String path = request.getRequestURI();
                if (path.startsWith("/api/v1/feed/")) {
                    if (vars.containsKey("postId")) guard.requirePost(vars.get("postId"));
                    else if (vars.containsKey("commentId")) guard.requireComment(vars.get("commentId"));
                }
                if (path.startsWith("/api/v1/stories/") && vars.containsKey("id")) guard.requireStory(vars.get("id"));
                return true;
            }
        });
    }
    @Override public boolean supports(MethodParameter method, Class<? extends HttpMessageConverter<?>> converter) { return true; }
    @Override public Object beforeBodyWrite(Object body, MethodParameter method, MediaType type, Class<? extends HttpMessageConverter<?>> converter, ServerHttpRequest request, ServerHttpResponse response) {
        if (body instanceof PostDto post) { guard.requirePost(post.getId()); }
        if (body instanceof StoryDto story) { guard.requireStory(story.getId()); }
        return filter(body);
    }
    private Object filter(Object body) {
        if (body instanceof Collection<?> items) return items.stream().filter(item -> !(item instanceof PostDto p) || guard.post(p.getId()))
                .filter(item -> !(item instanceof StoryDto s) || guard.story(s.getId())).map(this::filter).toList();
        if (body instanceof Map<?,?> map) {
            Map<Object,Object> result = new LinkedHashMap<>(); map.forEach((key,value) -> result.put(key, filter(value))); return result;
        }
        return body;
    }
}
