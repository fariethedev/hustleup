package com.hustleup.dating;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DatingProfileRepository extends JpaRepository<DatingProfile, String> {
    List<DatingProfile> findByGenderAndIdNot(String gender, String userId);
    List<DatingProfile> findByIdNot(String userId);
}
