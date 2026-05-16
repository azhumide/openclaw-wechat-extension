import * as path from "node:path";

export function resolveWechatSkillIdFromPath(filePath: string, skillRoots: string[]): string | undefined {
    const normalizedFile = path.resolve(filePath);
    for (const root of skillRoots) {
        const relative = path.relative(root, normalizedFile);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
            continue;
        }
        const segments = relative.split(path.sep).filter(Boolean);
        const skillId = segments[0]?.trim().toLowerCase();
        if (skillId) {
            return skillId;
        }
    }
    return undefined;
}
