import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateLinkedPictures,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  getMetadata,
  buildBlock,
  toCamelCase,
  fetchPlaceholders,
} from './aem.js';
import { decorateListingCards, applySectionBackgrounds } from './utils.js';

const LANGUAGES = new Set(['en', 'fr']);
let language;

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * Decorates h1, h2 headings with repeatable scroll animations
 * @param {Element} main The container element
 */
function decorateHeadings(main) {
  const headingElements = main.querySelectorAll('h1, h2');

  headingElements.forEach((heading) => {
    // Set initial styles (starting from left, invisible)
    heading.style.opacity = '0';
    heading.style.transform = 'translateX(-50px)';

    // Create individual observer for each heading
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Use Web Animations API for reliable animation (left to right)
          entry.target.animate([
            { opacity: 0, transform: 'translateX(-50px)' },
            { opacity: 1, transform: 'translateX(0)' },
          ], {
            duration: 1500,
            easing: 'ease',
            fill: 'forwards',
          });
        } else {
          // Fast reset animation back to left
          entry.target.animate([
            { opacity: 1, transform: 'translateX(0)' },
            { opacity: 0, transform: 'translateX(-50px)' },
          ], {
            duration: 100,
            easing: 'ease',
            fill: 'forwards',
          });
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    });

    observer.observe(heading);
  });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * @param {Element} main
 */
function buildOtherProjectsBlock(main) {
  // Only build the block on the main page content, not on fragments
  if (!document.body.contains(main) || main.closest('header, footer')) {
    return;
  }

  const template = getMetadata('template');
  if (template === 'project-article' || template === 'news-article') {
    const section = document.createElement('div');
    section.append(buildBlock('featured-projects', { elems: [template] }));
    main.append(section);
  }
}

export function getLanguageFromPath(pathname, resetCache = false) {
  if (resetCache) {
    language = undefined;
  }

  if (language !== undefined) return language;

  const segs = pathname.split('/');
  if (segs.length > 1) {
    const l = segs[1];
    if (LANGUAGES.has(l)) {
      language = l;
    }
  }

  if (language === undefined) {
    language = 'en'; // default to English
  }

  return language;
}

export function getLanguage(curPath = window.location.pathname, resetCache = false) {
  return getLanguageFromPath(curPath, resetCache);
}

export async function load404() {
  const placeholders = await fetchPlaceholders(`${getLanguage()}`);
  const { pageNotFoundText } = placeholders;

  // Update the paragraph text with placeholder content
  const errorMessage = document.querySelector('.error-message-container p');
  if (errorMessage && pageNotFoundText) {
    errorMessage.textContent = pageNotFoundText;
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

function getPolicyTemplateDynamicData(main) {
  const fetchclass = document.querySelector('.policy-template');
  fetch('/query-index.json')
    .then((res) => res.json())
    .then(async (output) => {
      const currentPath = window.location.pathname;
      const segs = currentPath.split('/');
      const pageSlug = segs[segs.length - 1];

      let i; let pageData;
      if (fetchclass) {
        for (i = 0; i < output.total; i += 1) {
          if (output.data[i].path === currentPath) {
            pageData = output.data[i];
          }
        }

        if (pageData) {
          const datechanged = pageData.lastModified;
          const date = new Date(datechanged * 1000);
          const formattedEng = `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getDate()}, ${date.getFullYear()}`;
          const formattedFr = `${date.getDate()} ${date.toLocaleDateString('fr-FR', { month: 'long' })}, ${date.getFullYear()}`;
          // fetch placeholders based on current language
          const currentLanguage = getLanguage();
          const placeholders = await fetchPlaceholders(currentLanguage);
          const strEng = `${formattedEng}`;
          const strFr = `${formattedFr}`;
          const info = document.createElement('span');
          info.classList.add('last-modified');

          if (currentLanguage === 'en') {
            if (pageSlug === 'privacy-notice') {
              info.textContent = `${placeholders.privacyPolicyUpdateText} ${strEng}`;
            } else if (pageSlug === 'terms-of-use') {
              info.textContent = `${placeholders.termsOfUseUpdateText} ${strEng}`;
            }
          } else if (currentLanguage === 'fr') {
            if (pageSlug === 'declaration-de-confidentialite') {
              info.textContent = `${placeholders.privacyPolicyUpdateText} ${strFr}`;
            } else if (pageSlug === 'conditions-dutilisation') {
              info.textContent = `${placeholders.termsOfUseUpdateText} ${strFr}`;
            }
          }

          main.appendChild(info);
        }
      }
    });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  decorateLinkedPictures(main);
  buildAutoBlocks(main);
  buildOtherProjectsBlock(main);
  decorateHeadings(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateListingCards(main);
}

/**
 * Decorates the template.
 */
export async function loadTemplate(doc, templateName) {
  try {
    const cssLoaded = new Promise((resolve) => {
      loadCSS(
        `${window.hlx.codeBasePath}/templates/${templateName}/${templateName}.css`,
      )
        .then(resolve)
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(
            `failed to load css module for ${templateName}`,
            err.target.href,
          );
          resolve();
        });
    });
    const decorationComplete = new Promise((resolve) => {
      (async () => {
        try {
          const mod = await import(
            `../templates/${templateName}/${templateName}.js`
          );
          if (mod.default) {
            await mod.default(doc);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log(`failed to load module for ${templateName}`, error);
        }
        resolve();
      })();
    });

    document.body.classList.add(`${templateName}-template`);

    await Promise.all([cssLoaded, decorationComplete]);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(`failed to load block ${templateName}`, error);
  }
}

export async function loadAllPlaceholders() {
  // Early return if already loaded
  if (window.placeholders && Object.keys(window.placeholders).length > 1) {
    return window.placeholders;
  }

  const currentLanguage = getLanguage();
  const sheetsToFetch = [
    currentLanguage,
    currentLanguage === 'en' ? 'fr' : 'en',
    'category-news',
    'category-projects',
    'language-switcher',
    currentLanguage === 'fr' ? 'mapmarkers-fr' : 'mapmarkers',
  ];

  // Create default structure
  const createDefaults = () => ({
    [currentLanguage]: {},
    [currentLanguage === 'en' ? 'fr' : 'en']: {},
    'category-news': { en: [], fr: [] },
    'category-projects': { en: [], fr: [] },
    'language-switcher': [],
  });

  // Sheet processors for different data types
  const processors = {
    category: (data) => data.reduce((acc, item) => {
      if (item.en) acc.en.push(item.en);
      if (item.fr) acc.fr.push(item.fr);
      return acc;
    }, { en: [], fr: [] }),

    language: (data) => data.reduce((acc, item) => {
      if (item.Key) acc[toCamelCase(item.Key)] = item.Text;
      return acc;
    }, {}),

    raw: (data) => data,
  };

  try {
    const response = await fetch(`/placeholders.json?${sheetsToFetch.map((s) => `sheet=${s}`).join('&')}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    window.placeholders = createDefaults();

    // Process each sheet with appropriate processor
    sheetsToFetch.forEach((sheetName) => {
      const data = json[sheetName]?.data;
      if (!data) return;

      if (sheetName === 'category-news' || sheetName === 'category-projects') {
        window.placeholders[sheetName] = processors.category(data);
      } else if (sheetName === 'language-switcher' || sheetName === 'mapmarkers' || sheetName === 'mapmarkers-fr') {
        window.placeholders[sheetName] = processors.raw(data);
      } else {
        window.placeholders[sheetName] = processors.language(data);
      }
    });

    // Merge current language to root for backward compatibility
    Object.assign(window.placeholders, window.placeholders[currentLanguage]);

    return window.placeholders;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error loading placeholders:', error);
    window.placeholders = createDefaults();
    return window.placeholders;
  }
}

/**
 * Detects the current site type based on hostname and pathname
 * @returns {string} The detected site type: 'biencommun', 'arbres', or 'fondations'
 */
export function detectSiteType() {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();

  // Handle localhost development - always use fondations default
  if (hostname.includes('localhost')) {
    return 'fondations';
  }

  // Site detection patterns for production/preview
  const sitePatterns = {
    biencommun: {
      hostname: ['biencommun.', '--biencommun-'],
      pathname: ['--biencommun-fondationsaudemarspiguet--'],
    },
    arbres: {
      hostname: ['arbres.', '--arbres-'],
      pathname: ['--arbres-fondationsaudemarspiguet--'],
    },
    fondations: {
      hostname: ['fondations.', '--fondations'],
      pathname: ['--fondationsaudemarspiguet--'],
    },
  };

  // Check each site type using array methods instead of for...of
  const siteTypes = Object.keys(sitePatterns);
  const matchedSiteType = siteTypes.find((siteType) => {
    const patterns = sitePatterns[siteType];
    const hostnameMatch = patterns.hostname.some((pattern) => hostname.includes(pattern));
    const pathnameMatch = patterns.pathname.some((pattern) => pathname.includes(pattern));

    return hostnameMatch || pathnameMatch;
  });

  return matchedSiteType || 'fondations'; // default fallback
}

/**
 * Applies the detected site class to the document body
 * @param {string} siteType - Optional site type override
 * @returns {string} The applied site class
 */
export function applySiteClass(siteType = null) {
  const detectedSite = siteType || detectSiteType();
  document.body.classList.add(detectedSite);
  return detectedSite;
}

/**
 * Gets favicon URLs for a specific site type
 * @param {string} siteType - The site type (biencommun, arbres, fondations)
 * @returns {object} Object with favicon URLs
 */
export function getFaviconUrls(siteType = null) {
  const detectedSite = siteType || detectSiteType();
  const faviconMappings = {
    biencommun: {
      apple: '/icons/biencommun-apple-touch-icon.png',
      favicon32: '/icons/biencommun-favicon-32x32.png',
      favicon16: '/icons/biencommun-favicon-16x16.png',
    },
    arbres: {
      apple: '/icons/arbres-apple-touch-icon.png',
      favicon32: '/icons/arbres-favicon-32x32.png',
      favicon16: '/icons/arbres-favicon-16x16.png',
    },
    fondations: {
      apple: '/icons/apple-touch-icon.png',
      favicon32: '/icons/favicon-32x32.png',
      favicon16: '/icons/favicon-16x16.png',
    },
    // Add more domain mappings as needed
  };
  return faviconMappings[detectedSite] || faviconMappings.fondations;
}

/**
 * Sets domain-specific favicon and CSS classes based on current URL
 */
export function setPathSpecificFavicon() {
  const detectedSite = detectSiteType();
  const faviconUrls = getFaviconUrls(detectedSite);

  // Check if favicon elements exist
  const favicon16Elements = document.querySelectorAll('link[rel="icon"][sizes="16x16"]');
  const favicon32Elements = document.querySelectorAll('link[rel="icon"][sizes="32x32"]');
  const appleIconElements = document.querySelectorAll('link[rel="apple-touch-icon"]');

  // Check if this is likely a 404 page (no favicon elements exist)
  const is404Page = favicon16Elements.length === 0
    && favicon32Elements.length === 0 && appleIconElements.length === 0;

  if (is404Page) {
    // Create favicons for 404/non-existing pages only
    const favicon16 = document.createElement('link');
    favicon16.rel = 'icon';
    favicon16.type = 'image/png';
    favicon16.sizes = '16x16';
    favicon16.href = faviconUrls.favicon16;
    document.head.appendChild(favicon16);

    const favicon32 = document.createElement('link');
    favicon32.rel = 'icon';
    favicon32.type = 'image/png';
    favicon32.sizes = '32x32';
    favicon32.href = faviconUrls.favicon32;
    document.head.appendChild(favicon32);

    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.sizes = '180x180';
    appleIcon.href = faviconUrls.apple;
    document.head.appendChild(appleIcon);
  } else {
    // Update existing favicons for regular pages
    favicon16Elements.forEach((favicon16) => {
      favicon16.href = faviconUrls.favicon16;
    });

    favicon32Elements.forEach((favicon32) => {
      favicon32.href = faviconUrls.favicon32;
    });
    appleIconElements.forEach((appleIcon) => {
      appleIcon.href = faviconUrls.apple;
    });
  }
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = getLanguage();

  // Load all placeholders early in the application lifecycle
  await loadAllPlaceholders();

  const templateName = getMetadata('template');
  decorateTemplateAndTheme();

  // Set path-specific favicon early in the load process
  setPathSpecificFavicon();

  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    if (templateName) {
      await loadTemplate(doc, templateName);
    }
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */

function backToTopWithIcon() {
  const main = document.querySelector('main');
  const pageButton = document.createElement('span');
  pageButton.className = 'page-level-btn';
  pageButton.style.position = 'fixed';
  pageButton.style.bottom = '20px';
  pageButton.style.zIndex = '999';
  pageButton.style.cursor = 'pointer';

  // Detect language from URL path
  const path = window.location.pathname;
  let svgSrc = '/icons/flech-to-top-en.svg';
  if (path.startsWith('/fr')) {
    svgSrc = '/icons/flech-to-top-fr.svg';
  }

  const svg = document.createElement('img');
  svg.src = svgSrc;
  svg.alt = 'Back to Top';
  svg.className = svgSrc.includes('-fr.svg') ? 'flech-to-top-fr' : 'flech-to-top-en';

  pageButton.appendChild(svg);
  main.appendChild(pageButton);

  window.addEventListener('scroll', () => {
    const { scrollY } = window;
    if (scrollY > 500) {
      pageButton.classList.add('show');
    } else {
      pageButton.classList.remove('show');
    }
  });

  pageButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  // Apply section backgrounds after all sections are loaded and decorated
  await applySectionBackgrounds();

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
  backToTopWithIcon();
  getPolicyTemplateDynamicData(main);
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();

const { searchParams, origin } = new URL(window.location.href);
const branch = searchParams.get('nx') || 'main';

export const NX_ORIGIN = branch === 'local' || origin.includes('localhost') ? 'http://localhost:6456/nx' : 'https://da.live/nx';

(async function loadDa() {
  /* eslint-disable import/no-unresolved */
  // Debug: Log current URL and parameters
  console.log('Current URL:', window.location.href);
  console.log('SearchParams dapreview:', searchParams.get('dapreview'));
  console.log('Is in iframe:', window !== window.top);

  // Check parent window URL if in iframe
  let parentUrl = '';
  try {
    if (window !== window.top) {
      parentUrl = window.top.location.href;
      console.log('Parent URL:', parentUrl);
    }
  } catch (e) {
    console.log('Cannot access parent URL (cross-origin)');
  }

  // Check multiple conditions for DA Live preview
  const hasDapreview = searchParams.get('dapreview')
                      || (window !== window.top && parentUrl.includes('da.live'))
                      || (window !== window.top && window.location.href.includes('dapreview='));

  console.log('Has dapreview (any condition):', hasDapreview);

  if (hasDapreview) {
    console.log('Adding da-live-preview-test class');
    document.body.classList.add('da-live-preview-test');
    // eslint-disable-next-line import/no-unresolved
    import('https://da.live/scripts/dapreview.js').then(({ default: daPreview }) => daPreview(loadPage));
  }
  if (searchParams.get('daexperiment')) {
    import(`${NX_ORIGIN}/public/plugins/exp/exp.js`);
  }
}());

document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('.contact-us a')) {
      e.preventDefault();
      window.open(e.target.href || e.target.closest('a').href, '_blank');
    }
  });
});
