import { siteDescription, siteTitle } from "@/lib/site";

/**
 * Website settings the owner manages in the Studio (backend: app/schemas/site.py). The bundled
 * content source uses DEFAULT_SETTINGS, which reproduce the site as it was before settings existed.
 */
export type SiteSettings = {
  seoTitle: string;
  seoDescription: string;
  showSkills: boolean;
  /** Experience, education and certifications. */
  showExperience: boolean;
  /** Off: the form is hidden (email and links stay) and the API refuses messages. */
  showContactForm: boolean;
  showCvDownload: boolean;
  homeProjectCount: number;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  seoTitle: siteTitle,
  seoDescription: siteDescription,
  showSkills: true,
  showExperience: true,
  showContactForm: true,
  showCvDownload: true,
  homeProjectCount: 3,
};

export type ApiSettings = {
  seo_title: string;
  seo_description: string;
  show_skills: boolean;
  show_experience: boolean;
  show_contact_form: boolean;
  show_cv_download: boolean;
  home_project_count: number;
};

export function settingsFromApi(data: ApiSettings | undefined): SiteSettings {
  if (!data) return DEFAULT_SETTINGS;
  return {
    seoTitle: data.seo_title,
    seoDescription: data.seo_description,
    showSkills: data.show_skills,
    showExperience: data.show_experience,
    showContactForm: data.show_contact_form,
    showCvDownload: data.show_cv_download,
    homeProjectCount: data.home_project_count,
  };
}

/** Home-page sections switched off, as navigation anchors ("#skills"), so links to them go too. */
export function hiddenSections(settings: SiteSettings): string[] {
  return [...(settings.showSkills ? [] : ["#skills"]), ...(settings.showExperience ? [] : ["#experience"])];
}
