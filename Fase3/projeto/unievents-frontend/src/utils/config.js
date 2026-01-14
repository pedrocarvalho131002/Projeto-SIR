export const API_BASE_URL = 
    import.meta.env.VITE_API_BASE_URL || "http://192.168.8.101:4000";

/**
 * Constructs the full URL for an image.
 * Falls back to a placeholder if the image is missing.
 * @param {string} path - The relative or absolute path of the image.
 * @returns {string} The full URL.
 */
export const getImageUrl = (path) => {
    if (!path) return "https://placehold.co/800x600?text=No+Image";
    if (path.startsWith('http')) return path;
    const prefix = path.startsWith('/') ? '' : '/uploads/';
    return `${API_BASE_URL}${prefix}${path}`;
};
