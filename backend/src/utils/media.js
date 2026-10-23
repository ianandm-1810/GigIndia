const isTrustedCloudinaryMedia = (url, mediaType) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || typeof url !== "string" || !["image", "video"].includes(mediaType)) return false;
  return url.startsWith(`https://res.cloudinary.com/${cloudName}/${mediaType}/upload/`);
};

module.exports = { isTrustedCloudinaryMedia };
