export type WechatInstalledSkillMatchInfo = {
    matched: boolean;
    reason?: "wrapper" | "script-path" | "skill-cwd-cli" | "readonly-probe" | "inline-eval-fallback";
    skillId?: string;
    segment?: string;
    path?: string;
    wrappers?: string[];
};
