// 测试进程启动时挂载 TS 解析钩子（配合 NODE_OPTIONS="--import <此文件>"）。
// 必须是纯注册：不能读 process.argv（在 --test 子进程中不可靠）。
import { register } from "node:module";

register("./ts-resolve-hook.mjs", import.meta.url);
