package com.hustleup.common.publisher;

import com.hustleup.common.model.PublisherProfile;
import com.hustleup.common.model.Role;
import com.hustleup.common.model.User;
import com.hustleup.common.repository.PublisherProfileRepository;
import com.hustleup.common.repository.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * The single place that answers "is this caller allowed to publish here?".
 *
 * <p>Jobs live in {@code hustleup-marketplace} and News in {@code hustleup-social}, so
 * without this each service would grow its own copy of the check. Two copies of a
 * permission rule is how they drift, and a drifted publishing gate means an unverified
 * account posting job adverts. The rule is written once, here, and both services call it.
 *
 * <p><b>The rule:</b> an {@code ADMIN} may always publish; anyone else needs an
 * {@link PublisherProfile} of the matching type in {@code APPROVED} state. {@code PENDING},
 * {@code REJECTED} and {@code SUSPENDED} all deny — being suspended must revoke posting
 * immediately, not merely stop future approvals.
 */
@Component
public class PublisherGuard {

    private final UserRepository userRepository;
    private final PublisherProfileRepository publisherRepository;

    public PublisherGuard(UserRepository userRepository, PublisherProfileRepository publisherRepository) {
        this.userRepository = userRepository;
        this.publisherRepository = publisherRepository;
    }

    /** Thrown when a caller lacks publishing rights; controllers map it to 403. */
    public static class NotAPublisherException extends RuntimeException {
        public NotAPublisherException(String message) { super(message); }
    }

    /** The authenticated user, or empty when the request is anonymous. */
    public Optional<User> currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || "anonymousUser".equals(auth.getName())) {
            return Optional.empty();
        }
        return userRepository.findByEmail(auth.getName());
    }

    /**
     * Resolves the caller's approved publisher profile of the given type, or throws.
     *
     * <p>Returns the profile rather than a boolean because every caller immediately needs
     * it: the company name and logo are stamped onto the job/article being created, so a
     * bare "yes" would just force a second lookup.
     *
     * @param type the publishing right being exercised
     * @return the caller's APPROVED profile, or a synthetic admin profile for ADMIN users
     * @throws NotAPublisherException if the caller may not publish, with a message
     *         explaining which state they are actually in
     */
    public PublisherProfile requirePublisher(PublisherProfile.PublisherType type) {
        User user = currentUser().orElseThrow(
                () -> new NotAPublisherException("You must be signed in to publish"));

        // Admins bypass the queue — they are the ones approving it, and they need to be
        // able to post corrections or take over an abandoned outlet.
        if (user.getRole() == Role.ADMIN) {
            return PublisherProfile.builder()
                    .userId(user.getId())
                    .type(type)
                    .status(PublisherProfile.PublisherStatus.APPROVED)
                    .companyName(user.getFullName() != null ? user.getFullName() : "HustleSpace")
                    .logoUrl(user.getAvatarUrl())
                    .build();
        }

        PublisherProfile profile = publisherRepository.findByUserIdAndType(user.getId(), type)
                .orElseThrow(() -> new NotAPublisherException(deniedMessage(type, null)));

        if (!profile.isActive()) {
            throw new NotAPublisherException(deniedMessage(type, profile.getStatus()));
        }
        return profile;
    }

    /** Whether the caller may publish, without throwing — for "can I see the compose button?" checks. */
    public boolean canPublish(PublisherProfile.PublisherType type) {
        try {
            requirePublisher(type);
            return true;
        } catch (NotAPublisherException e) {
            return false;
        }
    }

    /** Explains precisely why publishing was refused, so the UI can tell the user what to do next. */
    private String deniedMessage(PublisherProfile.PublisherType type, PublisherProfile.PublisherStatus status) {
        String what = type == PublisherProfile.PublisherType.HIRING_COMPANY
                ? "post jobs" : "publish news";
        String who = type == PublisherProfile.PublisherType.HIRING_COMPANY
                ? "verified hiring company" : "verified news outlet";
        if (status == null) {
            return "Only a " + who + " can " + what + ". Apply from your dashboard to get verified.";
        }
        return switch (status) {
            case PENDING   -> "Your " + who + " application is still under review — you'll be able to "
                              + what + " once it's approved.";
            case REJECTED  -> "Your " + who + " application was not approved. Check the reviewer's note "
                              + "and apply again.";
            case SUSPENDED -> "Your publishing access has been suspended. Contact support.";
            default        -> "Only a " + who + " can " + what + ".";
        };
    }
}
