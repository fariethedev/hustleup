package com.hustleup.social.repository;

import com.hustleup.social.model.DatingProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface DatingProfileRepository extends JpaRepository<DatingProfile, UUID> {
}
