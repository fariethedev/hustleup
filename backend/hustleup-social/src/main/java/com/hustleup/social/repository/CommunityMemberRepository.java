package com.hustleup.social.repository;

import com.hustleup.social.model.CommunityMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Who belongs to which community. */
@Repository
public interface CommunityMemberRepository extends JpaRepository<CommunityMember, CommunityMember.Id> {

    /** Every community one person has joined — the source of their Communities feed. */
    List<CommunityMember> findByIdMemberId(String memberId);

    /** Members of one community, for its page and its member count. */
    List<CommunityMember> findByIdCommunityId(String communityId);

    long countByIdCommunityId(String communityId);

    /**
     * The caller's memberships among a specific set of communities.
     *
     * <p>Batched rather than one existence check per card, so the browse list stays a
     * fixed number of queries however many communities are on screen.
     */
    List<CommunityMember> findByIdMemberIdAndIdCommunityIdIn(String memberId, List<String> communityIds);
}
