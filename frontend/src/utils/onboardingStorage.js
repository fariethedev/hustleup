const safeParse = (value) => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const getOnboardingStorageKey = (userId) => `hustleup_onboarding_${userId}`;

export const getStoredOnboarding = (userId) => {
  if (!userId) return null;
  return safeParse(localStorage.getItem(getOnboardingStorageKey(userId)));
};

export const mergeUserWithOnboarding = (user) => {
  if (!user?.id) return user;

  const onboarding = getStoredOnboarding(user.id);
  if (!onboarding) {
    return {
      ...user,
      onboarding: null,
      onboardingCompleted: false,
    };
  }

  return {
    ...user,
    onboarding,
    onboardingCompleted: Boolean(onboarding.completedAt),
  };
};

export const persistOnboarding = (userId, onboarding) => {
  if (!userId) return null;

  localStorage.setItem(getOnboardingStorageKey(userId), JSON.stringify(onboarding));

  const storedUser = safeParse(localStorage.getItem('hustleup_user'));
  if (storedUser?.id === userId) {
    localStorage.setItem(
      'hustleup_user',
      JSON.stringify({
        ...storedUser,
        onboarding,
        onboardingCompleted: Boolean(onboarding?.completedAt),
      }),
    );
  }

  return onboarding;
};
