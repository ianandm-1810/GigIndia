const User = require("../models/User");

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$/;
const SOCIAL_HOSTS = {
  github: new Set(["github.com", "www.github.com"]),
  linkedin: new Set(["linkedin.com", "www.linkedin.com"]),
  instagram: new Set(["instagram.com", "www.instagram.com"]),
  discord: new Set(["discord.com", "www.discord.com", "discord.gg", "discordapp.com", "www.discordapp.com"])
};

const normalizeUsername = (value) => String(value || "").trim().replace(/^@/, "").toLowerCase();

const usernameBase = (value) => {
  const base = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : "student";
};

const createAvailableUsername = async (preferred, excludedUserId = null) => {
  const requested = normalizeUsername(preferred);
  const base = USERNAME_PATTERN.test(requested) ? requested : usernameBase(preferred);
  const filter = excludedUserId ? { _id: { $ne: excludedUserId } } : {};

  for (let suffix = 1; suffix < 100000; suffix += 1) {
    const suffixText = suffix === 1 ? "" : `-${suffix}`;
    const candidate = `${base.slice(0, 24 - suffixText.length)}${suffixText}`;
    if (USERNAME_PATTERN.test(candidate) && !(await User.exists({ ...filter, username: candidate }))) {
      return candidate;
    }
  }
  throw new Error("Could not find an available username");
};

const normalizeHttpUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
};

const normalizeSocialLinks = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Social links must be provided as an object" };
  }
  const socialLinks = {};
  for (const [key, allowedHosts] of Object.entries(SOCIAL_HOSTS)) {
    const url = normalizeHttpUrl(value[key]);
    if (url === null) return { error: `Enter a valid ${key} URL` };
    if (url) {
      const hostname = new URL(url).hostname.toLowerCase();
      if (!allowedHosts.has(hostname)) return { error: `The ${key} link must use an official ${key} domain` };
    }
    socialLinks[key] = url;
  }
  return { socialLinks };
};

module.exports = { USERNAME_PATTERN, normalizeUsername, usernameBase, createAvailableUsername, normalizeHttpUrl, normalizeSocialLinks };
