/**
 * Validate MongoDB 24-hex-character ObjectId strings
 */
const isValidObjectId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

module.exports = {
  isValidObjectId,
};
