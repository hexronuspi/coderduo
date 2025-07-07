/**
 * Navigation utility functions to ensure consistent routing throughout the app
 */

// Universal router type that works with both App Router and Pages Router
interface UniversalRouter {
  push: (path: string) => void | Promise<boolean>;
}

/**
 * Safely navigates to the correct route, avoiding "page" in the URL
 * @param router Next.js router object (from either App Router or Pages Router)
 * @param path The path to navigate to (without trailing slash)
 */
export const safeNavigate = (router: UniversalRouter, path: string) => {
  // Remove any trailing slashes
  const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
  
  // Check if path ends with /page and remove it
  const safePath = cleanPath.endsWith('/page') 
    ? cleanPath.slice(0, -5) // Remove /page
    : cleanPath;
    
  router.push(safePath);
};
