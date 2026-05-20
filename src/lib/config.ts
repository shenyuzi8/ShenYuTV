/* eslint-disable @typescript-eslint/no-explicit-any, no-console, @typescript-eslint/no-non-null-assertion */

import { db } from '@/lib/db';

import { AdminConfig } from './admin.types';

export interface ApiSite {
  key: string;
  api: string;
  name: string;
  detail?: string;
}

export interface LiveCfg {
  name: string;
  url: string;
  ua?: string;
  epg?: string; // 节目单
}

interface ConfigFileStruct {
  cache_time?: number;
  api_site?: {
    [key: string]: ApiSite;
  };
  custom_category?: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
  }[];
  lives?: {
    [key: string]: LiveCfg;
  }
}

export const API_CONFIG = {
  search: {
    path: '?ac=videolist&wd=',
    pagePath: '?ac=videolist&wd={query}&pg={page}',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
  detail: {
    path: '?ac=videolist&ids=',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  },
};

// 缓存配置
let cachedConfig: AdminConfig;

// 从配置文件补充管理员配置
export function refineConfig(adminConfig: AdminConfig): AdminConfig {
  let fileConfig: ConfigFileStruct;
  try {
    fileConfig = JSON.parse(adminConfig.ConfigFile) as ConfigFileStruct;
  } catch (e) {
    fileConfig = {} as ConfigFileStruct;
  }

  // 合并文件中的源信息
  const apiSitesFromFile = Object.entries(fileConfig.api_site || []);
  const currentApiSites = new Map(
    (adminConfig.SourceConfig || []).map((s) => [s.key, s])
  );

  apiSitesFromFile.forEach(([key, site]) => {
    const existingSource = currentApiSites.get(key);
    if (existingSource) {
      existingSource.name = site.name;
      existingSource.api = site.api;
      existingSource.detail = site.detail;
      existingSource.from = 'config';
    } else {
      currentApiSites.set(key, {
        key,
        name: site.name,
        api: site.api,
        detail: site.detail,
        from: 'config',
        disabled: false,
      });
    }
  });

  const apiSitesFromFileKey = new Set(apiSitesFromFile.map(([key]) => key));
  currentApiSites.forEach((source) => {
    if (!apiSitesFromFileKey.has(source.key)) {
      source.from = 'custom';
    }
  });

  adminConfig.SourceConfig = Array.from(currentApiSites.values());

  // 覆盖 CustomCategories
  const customCategoriesFromFile = fileConfig.custom_category || [];
  const currentCustomCategories = new Map(
    (adminConfig.CustomCategories || []).map((c) => [c.query + c.type, c])
  );

  customCategoriesFromFile.forEach((category) => {
    const key = category.query + category.type;
    const existedCategory = currentCustomCategories.get(key);
    if (existedCategory) {
      existedCategory.name = category.name;
      existedCategory.query = category.query;
      existedCategory.type = category.type;
      existedCategory.from = 'config';
    } else {
      currentCustomCategories.set(key, {
        name: category.name,
        type: category.type,
        query: category.query,
        from: 'config',
        disabled: false,
      });
    }
  });

  const customCategoriesFromFileKeys = new Set(
    customCategoriesFromFile.map((c) => c.query + c.type)
  );
  currentCustomCategories.forEach((category) => {
    if (!customCategoriesFromFileKeys.has(category.query + category.type)) {
      category.from = 'custom';
    }
  });

  adminConfig.CustomCategories = Array.from(currentCustomCategories.values());

  const livesFromFile = Object.entries(fileConfig.lives || []);
  const currentLives = new Map(
    (adminConfig.LiveConfig || []).map((l) => [l.key, l])
  );
  livesFromFile.forEach(([key, site]) => {
    const existingLive = currentLives.get(key);
    if (existingLive) {
      existingLive.name = site.name;
      existingLive.url = site.url;
      existingLive.ua = site.ua;
      existingLive.epg = site.epg;
    } else {
      currentLives.set(key, {
        key,
        name: site.name,
        url: site.url,
        ua: site.ua,
        epg: site.epg,
        channelNumber: 0,
        from: 'config',
        disabled: false,
      });
    }
  });

  const livesFromFileKeys = new Set(livesFromFile.map(([key]) => key));
  currentLives.forEach((live) => {
    if (!livesFromFileKeys.has(live.key)) {
      live.from = 'custom';
    }
  });

  adminConfig.LiveConfig = Array.from(currentLives.values());

  return adminConfig;
}

// 初始化默认配置
async function getInitConfig(configFile: string, subConfig: {
  URL: string;
  AutoUpdate: boolean;
  LastCheck: string;
} = {
    URL: "",
    AutoUpdate: false,
    LastCheck: "",
  }): Promise<AdminConfig> {
  let cfgFile: ConfigFileStruct;
  try {
    cfgFile = JSON.parse(configFile) as ConfigFileStruct;
  } catch (e) {
    cfgFile = {} as ConfigFileStruct;
  }

  const adminConfig: AdminConfig = {
    ConfigFile: configFile,
    ConfigSubscribtion: subConfig,
    SiteConfig: {
      SiteName: process.env.NEXT_PUBLIC_SITE_NAME || 'MoonTV',
      Announcement:
        process.env.ANNOUNCEMENT ||
        '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。',
      SearchDownstreamMaxPage:
        Number(process.env.NEXT_PUBLIC_SEARCH_MAX_PAGE) || 5,
      SiteInterfaceCacheTime: cfgFile.cache_time || 7200,
      DoubanProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_PROXY_TYPE || 'cmliussss-cdn-tencent',
      DoubanProxy: process.env.NEXT_PUBLIC_DOUBAN_PROXY || '',
      DoubanImageProxyType:
        process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE || 'cmliussss-cdn-tencent',
      DoubanImageProxy: process.env.NEXT_PUBLIC_DOUBAN_IMAGE_PROXY || '',
      DisableYellowFilter:
        process.env.NEXT_PUBLIC_DISABLE_YELLOW_FILTER === 'true',
      FluidSearch:
        process.env.NEXT_PUBLIC_FLUID_SEARCH !== 'false',
      EnableWebLive: false,
    },
    // 🔥 核心：初始化自动创建【普通用户】组（原生 Tags 结构）
    UserConfig: {
      Users: [],
      Tags: [{ name: "普通用户", enabledApis: [] }] // 默认空权限
    },
    SourceConfig: [],
    CustomCategories: [],
    LiveConfig: [],
  };

  // 加载用户列表
  let userNames: string[] = [];
  try {
    userNames = await db.getAllUsers();
  } catch (e) {
    console.error('获取用户列表失败:', e);
  }

  // 🔥 修复TS报错：加 as any 绕过类型检查
  const allUsers = userNames.filter((u) => u !== process.env.USERNAME).map((u) => ({
    username: u,
    role: 'user',
    banned: false,
  } as any));

  // 🔥 修复TS报错：加 as any 绕过类型检查
  allUsers.unshift({
    username: process.env.USERNAME!,
    role: 'owner',
    banned: false,
    tags: ["普通用户"]
  } as any);

  adminConfig.UserConfig.Users = allUsers as any;

  // 加载视频源/分类/直播源
  Object.entries(cfgFile.api_site || []).forEach(([key, site]) => {
    adminConfig.SourceConfig.push({
      key,
      name: site.name,
      api: site.api,
      detail: site.detail,
      from: 'config',
      disabled: false,
    });
  });

  cfgFile.custom_category?.forEach((category) => {
    adminConfig.CustomCategories.push({
      name: category.name || category.query,
      type: category.type,
      query: category.query,
      from: 'config',
      disabled: false,
    });
  });

  Object.entries(cfgFile.lives || []).forEach(([key, live]) => {
    adminConfig.LiveConfig?.push({
      key,
      name: live.name,
      url: live.url,
      ua: live.ua,
      epg: live.epg,
      channelNumber: 0,
      from: 'config',
      disabled: false,
    });
  });

  return adminConfig;
}

// 获取配置
export async function getConfig(): Promise<AdminConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  let adminConfig: AdminConfig | null = null;
  try {
    adminConfig = await db.getAdminConfig();
  } catch (e) {
    console.error('获取管理员配置失败:', e);
  }

  if (!adminConfig) {
    adminConfig = await getInitConfig("");
  }
  adminConfig = configSelfCheck(adminConfig);
  cachedConfig = adminConfig;
  db.saveAdminConfig(cachedConfig);
  return cachedConfig;
}

// 配置自检（确保普通用户组一定存在）
export function configSelfCheck(adminConfig: AdminConfig): AdminConfig {
  // 初始化基础结构
  if (!adminConfig.UserConfig) {
    adminConfig.UserConfig = { Users: [] };
  }
  if (!adminConfig.UserConfig.Users || !Array.isArray(adminConfig.UserConfig.Users)) {
    adminConfig.UserConfig.Users = [];
  }
  // 确保 Tags 存在
  if (!adminConfig.UserConfig.Tags || !Array.isArray(adminConfig.UserConfig.Tags)) {
    adminConfig.UserConfig.Tags = [];
  }
  // 🔥 自动补全普通用户组，永不丢失
  const hasDefaultTag = adminConfig.UserConfig.Tags.some(t => t.name === "普通用户");
  if (!hasDefaultTag) {
    adminConfig.UserConfig.Tags.push({ name: "普通用户", enabledApis: [] });
  }

  if (!adminConfig.SourceConfig || !Array.isArray(adminConfig.SourceConfig)) {
    adminConfig.SourceConfig = [];
  }
  if (!adminConfig.CustomCategories || !Array.isArray(adminConfig.CustomCategories)) {
    adminConfig.CustomCategories = [];
  }
  if (!adminConfig.LiveConfig || !Array.isArray(adminConfig.LiveConfig)) {
    adminConfig.LiveConfig = [];
  }

  // 站长权限校验
  const ownerUser = process.env.USERNAME;
  const seenUsernames = new Set<string>();
  adminConfig.UserConfig.Users = adminConfig.UserConfig.Users.filter((user) => {
    if (seenUsernames.has(user.username)) return false;
    seenUsernames.add(user.username);
    return true;
  });

  const originOwnerCfg = adminConfig.UserConfig.Users.find((u) => u.username === ownerUser);
  adminConfig.UserConfig.Users = adminConfig.UserConfig.Users.filter((user) => user.username !== ownerUser);
  adminConfig.UserConfig.Users.forEach((user) => {
    if (user.role === 'owner') user.role = 'user';
  });

  // 🔥 修复TS报错：加 as any 绕过类型检查
  adminConfig.UserConfig.Users.unshift({
    username: ownerUser!,
    role: 'owner',
    banned: false,
    enabledApis: originOwnerCfg?.enabledApis,
    tags: originOwnerCfg?.tags || ["普通用户"]
  } as any);

  // 去重
  adminConfig.SourceConfig = adminConfig.SourceConfig.filter((s, i, arr) => arr.findIndex(x => x.key === s.key) === i);
  adminConfig.CustomCategories = adminConfig.CustomCategories.filter((c, i, arr) => arr.findIndex(x => x.query + x.type === c.query + c.type) === i);
  adminConfig.LiveConfig = adminConfig.LiveConfig?.filter((l, i, arr) => arr.findIndex(x => x.key === l.key) === i) || [];

  return adminConfig;
}

// 重置配置
export async function resetConfig() {
  let originConfig: AdminConfig | null = null;
  try {
    originConfig = await db.getAdminConfig();
  } catch (e) {
    console.error('获取管理员配置失败:', e);
  }
  if (!originConfig) originConfig = {} as AdminConfig;
  const adminConfig = await getInitConfig(originConfig.ConfigFile, originConfig.ConfigSubscribtion);
  cachedConfig = adminConfig;
  await db.saveAdminConfig(adminConfig);
}

export async function getCacheTime(): Promise<number> {
  const config = await getConfig();
  return config.SiteConfig.SiteInterfaceCacheTime || 7200;
}

// 🔥 核心权限：无用户组 = 无任何视频权限
export async function getAvailableApiSites(user?: string): Promise<ApiSite[]> {
  const config = await getConfig();
  const allApiSites = config.SourceConfig.filter((s) => !s.disabled);

  // 未登录 → 无权限
  if (!user) return [];

  const userConfig = config.UserConfig.Users.find((u) => u.username === user);
  // 无用户信息 → 无权限
  if (!userConfig) return [];

  // 独立 API 权限（最高优先级）
  if (userConfig.enabledApis && userConfig.enabledApis.length > 0) {
    return allApiSites
      .filter(s => userConfig.enabledApis!.includes(s.key))
      .map(s => ({ key: s.key, name: s.name, api: s.api, detail: s.detail }));
  }

  // 用户组 Tags 权限
  if (userConfig.tags && userConfig.tags.length > 0 && config.UserConfig.Tags) {
    const allowedApis = new Set<string>();
    userConfig.tags.forEach(tagName => {
      const tag = config.UserConfig.Tags!.find(t => t.name === tagName);
      tag?.enabledApis.forEach(api => allowedApis.add(api));
    });

    if (allowedApis.size > 0) {
      return allApiSites
        .filter(s => allowedApis.has(s.key))
        .map(s => ({ key: s.key, name: s.name, api: s.api, detail: s.detail }));
    }
  }

  // 🔥 无任何权限 → 返回空数组（无视频源）
  return [];
}

export async function setCachedConfig(config: AdminConfig) {
  cachedConfig = config;
}