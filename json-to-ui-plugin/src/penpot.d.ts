/**
 * Penpot 插件类型声明
 * 声明全局 penpot 对象
 */

import type { Penpot } from '@penpot/plugin-types';

declare global {
  const penpot: Penpot;
}

export {};
