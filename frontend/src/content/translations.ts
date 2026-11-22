/**
 * French and Kinyarwanda versions of the verified content in ./profile.ts. DRAFT translations,
 * written for the owner to review (Kinyarwanda especially) before release.
 *
 * Each language overlays the English records, matched by a stable key (a project's slug, an
 * institution, a skill group's English name...). Anything without an entry stays in English. The
 * same overlays feed the bundled site (src/lib/content/map.ts) and the database export
 * (scripts/export-content.mjs, which turns them into each record's `translations`).
 *
 * No path aliases and type-only imports, so Node can load this file in the export script.
 */
import type {
  Certification,
  Education,
  Experience,
  Principle,
  Profile,
  Project,
  ProjectDetails,
  SkillGroup,
} from "./profile";

export type TranslatedLanguage = "fr" | "rw";

type ProfileText = Partial<
  Pick<
    Profile,
    | "title"
    | "location"
    | "availability"
    | "headline"
    | "summary"
    | "aboutLead"
    | "aboutBody"
    | "portraitAlt"
    | "contactIntro"
  >
>;
type DetailsText = Partial<
  Pick<
    ProjectDetails,
    | "overview"
    | "problem"
    | "objectives"
    | "approach"
    | "architecture"
    | "decisions"
    | "challenges"
    | "outcomes"
    | "scope"
  >
>;

export type ContentOverlay = {
  profile: ProfileText;
  /** By position, like the English list. */
  principles: Pick<Principle, "title" | "body">[];
  /** English group name → translated name (skills themselves are technologies). */
  skillGroups: Record<string, string>;
  /** By slug. */
  projects: Record<string, Partial<Pick<Project, "category" | "summary">> & { details?: DetailsText }>;
  /** By "organization|role" in English. */
  experience: Record<string, Partial<Pick<Experience, "organization" | "role" | "highlights">>>;
  /** By English institution name. */
  education: Record<
    string,
    Partial<Pick<Education, "institution" | "degree" | "location" | "status" | "coursework">>
  >;
  /** By English certification name. */
  certifications: Record<string, Partial<Pick<Certification, "name" | "issuer">>>;
  /** The default search-engine title and description (the Studio's settings override them). */
  settings: { seoTitle: string; seoDescription: string };
};

/** Month names and "Present", for experience periods such as "January 2026 – Present". */
export const PERIOD_WORDS: Record<"en" | TranslatedLanguage, { months: string[]; present: string }> = {
  en: {
    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    present: "Present",
  },
  fr: {
    months: [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ],
    present: "aujourd'hui",
  },
  rw: {
    months: [
      "Mutarama",
      "Gashyantare",
      "Werurwe",
      "Mata",
      "Gicurasi",
      "Kamena",
      "Nyakanga",
      "Kanama",
      "Nzeri",
      "Ukwakira",
      "Ugushyingo",
      "Ukuboza",
    ],
    present: "Ubu",
  },
};

/** "January 2026 – Present" in another language ("janvier 2026 – aujourd'hui"). */
export function translatePeriod(period: string, lang: "en" | TranslatedLanguage): string {
  if (lang === "en") return period;
  const words = PERIOD_WORDS[lang];
  return period
    .split(/(\s+)/)
    .map((word) => {
      const month = PERIOD_WORDS.en.months.indexOf(word);
      if (month !== -1) return words.months[month]!;
      return word === PERIOD_WORDS.en.present ? words.present : word;
    })
    .join("");
}

export const translations: Record<TranslatedLanguage, ContentOverlay> = {
  fr: {
    profile: {
      title: "Ingénieur logiciel backend",
      location: "Kigali, Rwanda",
      availability: "Disponible pour des opportunités backend",
      headline: "Concevoir des systèmes backend fiables pour des problèmes concrets.",
      summary:
        "Développeur backend chez SilverLandTech et étudiant en informatique à l'Université du Rwanda. Je conçois des API REST et des services orientés données avec Python, FastAPI et PostgreSQL.",
      aboutLead:
        "Un développeur à l'esprit backend, passionné par les systèmes fiables et évolutifs et par la technologie qui résout des problèmes concrets.",
      aboutBody: [
        "Je développe des applications backend avec Python, FastAPI, Java, PostgreSQL, SQL et des API REST, avec de l'expérience dans la conception d'API, la mise en œuvre de la logique métier et la création de logiciels maintenables. Je travaille aussi avec JavaScript et React, ce qui m'aide à collaborer tout au long du cycle de développement.",
        "Je m'intéresse particulièrement à l'ingénierie backend, à la conception de systèmes, aux technologies cloud et aux applications fondées sur l'IA.",
      ],
      portraitAlt: "Portrait de Jean Claude Ishimwe",
      contactIntro:
        "Ouvert aux stages en ingénierie backend, aux programmes pour jeunes diplômés, aux postes d'ingénieur backend junior et aux opportunités en génie logiciel.",
    },
    principles: [
      {
        title: "Architecture",
        body: "Des frontières claires, une logique métier cohérente et une structure de services maintenable.",
      },
      {
        title: "Ingénierie des bases de données",
        body: "Des schémas, des relations et une persistance réfléchis, construits autour du domaine.",
      },
      {
        title: "Conception d'API",
        body: "Des contrats explicites et des interfaces REST sur lesquels les équipes frontend peuvent s'appuyer.",
      },
      {
        title: "Qualité logicielle",
        body: "Une attention portée à la fiabilité, à l'authentification et à un code qui reste compréhensible.",
      },
    ],
    skillGroups: {
      "Programming languages": "Langages de programmation",
      "Backend engineering": "Ingénierie backend",
      Databases: "Bases de données",
      Frontend: "Frontend",
      Tools: "Outils",
      Practices: "Pratiques",
    },
    projects: {
      mosaic: {
        category: "Plateforme backend",
        summary:
          "Une plateforme d'aide à la décision pour la chaîne d'approvisionnement, destinée aux distributeurs de taille intermédiaire, à commencer par les entreprises de distribution africaines. La base actuelle est un backend FastAPI en monolithe modulaire avec des migrations PostgreSQL ; le moteur de décision n'est pas encore implémenté.",
        details: {
          overview: [
            "MOSAIC est une plateforme d'aide à la décision pour la chaîne d'approvisionnement, destinée aux distributeurs de taille intermédiaire, à commencer par les entreprises de distribution africaines.",
            "Le dépôt contient sa base orientée production : un backend FastAPI en monolithe modulaire, la persistance et les migrations PostgreSQL, un frontend React minimal, des services de développement Docker Compose et des contrôles qualité automatisés.",
          ],
          problem:
            "Les distributeurs de taille intermédiaire utilisent déjà des systèmes ERP, de stock, de comptabilité, de caisse et des tableurs. MOSAIC doit se placer au-dessus d'eux et expliquer ce qui se passe, pourquoi cela se passe et ce que l'entreprise devrait faire ensuite.",
          objectives: [
            "Construire d'abord les fondations d'ingestion et d'exploitation.",
            "Ajouter ensuite, progressivement, la prévision, l'optimisation, la simulation de scénarios et les recommandations.",
          ],
          approach:
            "Un monolithe modulaire : un service FastAPI aux couches explicites, PostgreSQL comme système de référence avec un schéma géré par migrations, et un frontend React et TypeScript qui n'intègre jamais d'identifiants. La qualité est garantie par pytest, Ruff et mypy.",
          architecture: [
            "Cœur : configuration, sécurité et préoccupations communes de l'application.",
            "Modèles et schémas : modèles de persistance SQLAlchemy et contrats d'API Pydantic.",
            "Routeurs : points d'accès HTTP légers.",
            "Services : orchestration applicative et limites de transaction.",
            "Domaine : modules indépendants du framework, réservés au futur moteur de décision.",
            "Infrastructure : base de données et adaptateurs externes.",
          ],
          decisions: [
            {
              title: "Accès aux données cloisonné par organisation",
              detail:
                "Les API de données de référence et d'analyse sont authentifiées et limitées à l'organisation de l'utilisateur, et les identifiants d'organisation ne sont jamais acceptés depuis le client.",
            },
            {
              title: "Agrégation dans PostgreSQL",
              detail:
                "Les analyses de ventes sont agrégées dans la base de données, dans le périmètre de l'organisation ; le navigateur n'agrège jamais les données de ventes brutes.",
            },
            {
              title: "Sessions révocables stockées en base",
              detail:
                "La connexion crée une session révocable et la déconnexion ne révoque que la session en cours. Les jetons de réinitialisation du mot de passe sont hachés, expirent, ne servent qu'une fois et révoquent les sessions actives lorsqu'ils sont utilisés.",
            },
            {
              title: "Configuration de production sûre",
              detail:
                "La configuration de production refuse le mode débogage, les clés de signature de développement, le mot de passe par défaut de la base, SQLite et les origines CORS génériques ou locales.",
            },
          ],
          scope: {
            implemented: [
              "Imports CSV de l'historique des ventes, des produits, des entrepôts, des fournisseurs et des instantanés de stock.",
              "Une API d'analyse des ventes cloisonnée par organisation, regroupée par date, par produit ou par entrepôt.",
              "Un tableau de bord du chiffre d'affaires, des transactions et des tendances.",
              "La vérification de l'adresse e-mail et la connexion Google facultative.",
            ],
            notYetImplemented: [
              "Le moteur de décision : prévision, apprentissage automatique, optimisation, simulation de scénarios et recommandations.",
              "La synchronisation avec les ERP.",
              "Les permissions par rôle et un limiteur de débit distribué.",
            ],
          },
        },
      },
      "school-management-system": {
        category: "Backend et application web",
        summary:
          "Une application Java full-stack pour gérer les élèves, les enseignants, les cours, les présences et les bulletins, avec une authentification sécurisée sur une architecture MVC.",
      },
      "buzhub-platform": {
        category: "Contribution backend",
        summary:
          "Une contribution au développement backend, centrée sur la conception d'API, la logique métier et la persistance, pour une plateforme construite autour de besoins produits réels.",
      },
      "portfolio-website": {
        category: "Projet full-stack",
        summary:
          "Ce site : un portfolio personnel responsive qui présente mes projets, mes compétences et mon expérience, avec un frontend Next.js et un backend FastAPI et PostgreSQL.",
      },
    },
    experience: {
      "SilverLandTech|Backend Developer": {
        role: "Développeur backend",
        highlights: [
          "Je développe des services backend évolutifs avec FastAPI et PostgreSQL.",
          "Je conçois et maintiens des API REST pour des applications métier.",
          "Je collabore avec les développeurs frontend pour intégrer les API et améliorer les performances.",
          "Je participe au débogage, aux revues de code et aux discussions sur l'architecture backend.",
        ],
      },
      "Techinika|Technical Writer": {
        role: "Rédacteur technique",
        highlights: [
          "Rédaction d'articles techniques expliquant des concepts de génie logiciel.",
          "Production de contenus techniques pédagogiques en collaboration avec l'équipe éditoriale.",
        ],
      },
    },
    education: {
      "University of Rwanda": {
        institution: "Université du Rwanda",
        degree: "Licence en informatique",
        location: "Kigali, Rwanda",
        status: "En cours",
        coursework: [
          "Structures de données et algorithmes",
          "Systèmes de bases de données",
          "Génie logiciel",
          "Développement web",
        ],
      },
    },
    certifications: {
      "Python programming": { name: "Programmation Python" },
      "Data Structures and Algorithms": { name: "Structures de données et algorithmes" },
    },
    settings: {
      seoTitle: "Jean Claude Ishimwe — Ingénieur logiciel backend",
      seoDescription:
        "Ingénieur logiciel backend à Kigali, au Rwanda : des API fiables, des applications orientées données et des systèmes logiciels maintenables avec Python, FastAPI et PostgreSQL.",
    },
  },
  rw: {
    profile: {
      title: "Injeniyeri wa porogaramu za backend",
      location: "Kigali, Rwanda",
      availability: "Niteguye amahirwe y'akazi ka backend",
      headline: "Nubaka sisitemu za backend zizewe zikemura ibibazo nyabyo.",
      summary:
        "Ndi umukozi ukora backend muri SilverLandTech kandi niga ibijyanye na mudasobwa (Computer Science) muri Kaminuza y'u Rwanda. Nkora API za REST na serivisi zishingiye ku makuru nkoresheje Python, FastAPI na PostgreSQL.",
      aboutLead:
        "Ndi umwubatsi wibanda kuri backend, ukunda sisitemu zizewe kandi zaguka, n'ikoranabuhanga rikemura ibibazo nyabyo.",
      aboutBody: [
        "Nkora porogaramu za backend nkoresheje Python, FastAPI, Java, PostgreSQL, SQL na API za REST, mfite uburambe mu gutegura API, gushyira mu bikorwa logique ya backend no kubaka porogaramu zoroshye kwitaho. Nkoresha kandi JavaScript na React, bimfasha gukorana n'abandi mu byiciro byose byo gukora porogaramu.",
        "Nshishikajwe cyane n'ubuhanga bwa backend, igishushanyo cya sisitemu, ikoranabuhanga rya cloud na porogaramu zikoresha ubwenge bw'ubukorano (AI).",
      ],
      portraitAlt: "Ifoto ya Jean Claude Ishimwe",
      contactIntro:
        "Niteguye kwimenyereza umwuga (internship) mu buhanga bwa backend, gahunda z'abarangije amashuri, imyanya ya injeniyeri wa backend utangira, n'andi mahirwe mu buhanga bwa porogaramu.",
    },
    principles: [
      {
        title: "Imiterere ya sisitemu",
        body: "Imipaka isobanutse, logique y'ubucuruzi ihuje n'imiterere ya serivisi yoroshye kwitaho.",
      },
      {
        title: "Ubuhanga bw'ububiko bw'amakuru",
        body: "Imiterere y'amakuru, isano hagati yayo n'uburyo bwo kuyabika bitekerejweho neza, bishingiye ku rwego bikoreramo.",
      },
      {
        title: "Igishushanyo cya API",
        body: "Amasezerano asobanutse n'imiyoboro ya REST amatsinda ya frontend ashobora gukoresha byoroshye.",
      },
      {
        title: "Ireme ry'ubuhanga",
        body: "Kwita ku kwizerwa, ku kwemeza abakoresha no kuri kode ikomeza kumvikana.",
      },
    ],
    skillGroups: {
      "Programming languages": "Indimi za porogaramu",
      "Backend engineering": "Ubuhanga bwa backend",
      Databases: "Ububiko bw'amakuru",
      Frontend: "Frontend",
      Tools: "Ibikoresho",
      Practices: "Imikorere",
    },
    projects: {
      mosaic: {
        category: "Urubuga rwa backend",
        summary:
          "Urubuga rufasha gufata ibyemezo mu ruhererekane rw'itangwa ry'ibicuruzwa, rugenewe abacuruzi bo hagati, uhereye ku bigo by'ubucuruzi bwo gukwirakwiza ibicuruzwa muri Afurika. Ishingiro ririho ubu ni backend ya FastAPI yubatse nka monolithe igabanyijemo modules, ifite migrations za PostgreSQL; moteri yo gufata ibyemezo ntirashyirwa mu bikorwa.",
        details: {
          overview: [
            "MOSAIC ni urubuga rufasha gufata ibyemezo mu ruhererekane rw'itangwa ry'ibicuruzwa, rugenewe abacuruzi bo hagati, uhereye ku bigo byo gukwirakwiza ibicuruzwa muri Afurika.",
            "Ububiko bwa kode burimo ishingiro ryateguwe gukoreshwa mu kazi nyakuri: backend ya FastAPI yubatse nka monolithe igabanyijemo modules, ububiko n'impinduka (migrations) za PostgreSQL, frontend nto ya React, serivisi zo gukora porogaramu za Docker Compose n'igenzura ry'ireme rikora ubwaryo.",
          ],
          problem:
            "Abacuruzi bo hagati basanzwe bakoresha sisitemu za ERP, iz'ububiko bw'ibicuruzwa, iz'ibaruramari, iz'ubwishyu (POS) n'imbonerahamwe (spreadsheets). MOSAIC igamije kuba hejuru yazo igasobanura ibiri kuba, impamvu biri kuba, n'icyo ikigo gikwiye gukora gikurikiyeho.",
          objectives: [
            "Kubanza kubaka ishingiro ryo kwakira amakuru no gukurikirana ibikorwa.",
            "Nyuma y'iryo shingiro, kongeramo buhoro buhoro iteganyagihe ry'ibicuruzwa, kunoza imikorere, kugerageza ibishoboka no gutanga inama.",
          ],
          approach:
            "Monolithe igabanyijemo modules: serivisi imwe ya FastAPI ifite ibyiciro bisobanutse, PostgreSQL nk'ububiko nyamukuru bw'amakuru bufite imiterere icungwa na migrations, na frontend ya React na TypeScript itigera ibika amabanga yo kwinjira. Ireme ryubahirizwa hakoreshejwe pytest, Ruff na mypy.",
          architecture: [
            "Intangiriro: igenamiterere, umutekano n'ibisangiwe na porogaramu yose.",
            "Models na schemas: models za SQLAlchemy zo kubika amakuru n'amasezerano ya API ya Pydantic.",
            "Routers: imiyoboro ya HTTP yoroheje.",
            "Serivisi: gutunganya imikorere ya porogaramu n'imipaka y'ibikorwa (transactions).",
            "Domaine: modules zidashingiye kuri framework, zigenewe moteri yo gufata ibyemezo izaza.",
            "Infrastructure: ububiko bw'amakuru n'ibihuza na sisitemu zo hanze.",
          ],
          decisions: [
            {
              title: "Kugera ku makuru bigarukira ku kigo",
              detail:
                "API z'amakuru y'ibanze n'isesengura zisaba kwinjira kandi zigarukira ku kigo cy'ukoresha, kandi nimero iranga ikigo ntiyakirwa ivuye ku mukoresha.",
            },
            {
              title: "Guteranya amakuru muri PostgreSQL",
              detail:
                "Isesengura ry'ibicuruzwa byagurishijwe riteranyirizwa mu bubiko bw'amakuru, mu rwego rw'ikigo; mudasobwa y'ukoresha ntiteranya amakuru y'igurisha y'ibanze.",
            },
            {
              title: "Sessions zishobora guhagarikwa, zibitswe mu bubiko",
              detail:
                "Kwinjira bitangiza session ishobora guhagarikwa, naho gusohoka bihagarika iya none yonyine. Tokens zo guhindura ijambo ry'ibanga ziba zihishe (hashed), zirangira, zikoreshwa rimwe gusa, kandi zihagarika sessions zikora iyo zikoreshejwe.",
            },
            {
              title: "Igenamiterere ryizewe ry'ahakorerwa",
              detail:
                "Igenamiterere ry'ahakorerwa ryanga uburyo bwa debug, imfunguzo zo gusinya zo mu igerageza, ijambo ry'ibanga risanzwe ry'ububiko, SQLite n'inkomoko za CORS zose cyangwa izo kuri mudasobwa.",
            },
          ],
          scope: {
            implemented: [
              "Kwinjiza amadosiye ya CSV y'amateka y'igurisha, ibicuruzwa, ububiko, abatanga ibicuruzwa n'uko ububiko buhagaze.",
              "API y'isesengura ry'igurisha igarukira ku kigo, iteranyije hakurikijwe itariki, igicuruzwa cyangwa ububiko.",
              "Ikibaho cy'incamake cy'amafaranga yinjiye, ibikorwa n'uko bihinduka.",
              "Kwemeza imeyili no kwinjira ukoresheje Google (bitari itegeko).",
            ],
            notYetImplemented: [
              "Moteri yo gufata ibyemezo: iteganyagihe, machine learning, kunoza imikorere, kugerageza ibishoboka no gutanga inama.",
              "Guhuza na sisitemu za ERP.",
              "Uburenganzira bushingiye ku nshingano n'igabanya-busabe rikorera ahantu henshi.",
            ],
          },
        },
      },
      "school-management-system": {
        category: "Backend na porogaramu y'urubuga",
        summary:
          "Porogaramu ya Java yuzuye yo gucunga abanyeshuri, abarimu, amasomo, ubwitabire na raporo, ifite uburyo bwizewe bwo kwinjira bwubakiye ku miterere ya MVC.",
      },
      "buzhub-platform": {
        category: "Uruhare muri backend",
        summary:
          "Uruhare mu gukora backend, rwibanda ku gutegura API, logique y'ubucuruzi no kubika amakuru, ku rubuga rwubakiye ku byo abakoresha bakeneye koko.",
      },
      "portfolio-website": {
        category: "Umushinga wuzuye (full-stack)",
        summary:
          "Uru rubuga: portfolio yanjye igaragaza imishinga, ubumenyi n'uburambe, yubatswe na frontend ya Next.js na backend ya FastAPI na PostgreSQL.",
      },
    },
    experience: {
      "SilverLandTech|Backend Developer": {
        role: "Ukora backend (Backend Developer)",
        highlights: [
          "Nkora serivisi za backend zishobora kwaguka nkoresheje FastAPI na PostgreSQL.",
          "Ntegura kandi nkita kuri API za REST zikoreshwa na porogaramu z'ubucuruzi.",
          "Nkorana n'abakora frontend mu guhuza API no kunoza umuvuduko.",
          "Ngira uruhare mu gukosora amakosa, gusuzuma kode n'ibiganiro ku miterere ya backend.",
        ],
      },
      "Techinika|Technical Writer": {
        role: "Umwanditsi w'inyandiko za tekiniki",
        highlights: [
          "Nanditse inyandiko za tekiniki zisobanura amahame y'ubuhanga bwa porogaramu.",
          "Nakoze inyandiko za tekiniki zigisha, mfatanyije n'abagize itsinda ry'abanditsi.",
        ],
      },
    },
    education: {
      "University of Rwanda": {
        institution: "Kaminuza y'u Rwanda",
        degree: "Impamyabumenyi y'icyiciro cya kabiri muri Computer Science",
        location: "Kigali, Rwanda",
        status: "Ndacyiga",
        coursework: [
          "Imiterere y'amakuru na algorithms",
          "Sisitemu z'ububiko bw'amakuru",
          "Ubuhanga bwa porogaramu",
          "Gukora imbuga za interineti",
        ],
      },
    },
    certifications: {
      "Python programming": { name: "Porogaramu za Python" },
      "Data Structures and Algorithms": { name: "Imiterere y'amakuru na algorithms" },
    },
    settings: {
      seoTitle: "Jean Claude Ishimwe — Injeniyeri wa backend",
      seoDescription:
        "Injeniyeri wa porogaramu za backend i Kigali mu Rwanda, wubaka API zizewe, porogaramu zishingiye ku makuru na sisitemu zoroshye kwitaho akoresheje Python, FastAPI na PostgreSQL.",
    },
  },
};

type Source = {
  profile: Profile;
  principles: Principle[];
  skillGroups: SkillGroup[];
  projects: Project[];
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
};

/** The content in a language: each record with its translation laid over the English. */
export function localizeSource<T extends Source>(source: T, lang: "en" | TranslatedLanguage): T {
  if (lang === "en") return source;
  const t = translations[lang];
  return {
    ...source,
    profile: { ...source.profile, ...t.profile },
    principles: source.principles.map((item, index) => ({ ...item, ...(t.principles[index] ?? {}) })),
    skillGroups: source.skillGroups.map((group) => ({
      ...group,
      name: t.skillGroups[group.name] ?? group.name,
    })),
    projects: source.projects.map((project) => {
      const overlay = t.projects[project.slug];
      if (!overlay) return project;
      const { details, ...fields } = overlay;
      return {
        ...project,
        ...fields,
        details: project.details && details ? { ...project.details, ...details } : project.details,
      };
    }),
    experience: source.experience.map((job) => ({
      ...job,
      ...(t.experience[`${job.organization}|${job.role}`] ?? {}),
      period: translatePeriod(job.period, lang),
    })),
    education: source.education.map((entry) => ({ ...entry, ...(t.education[entry.institution] ?? {}) })),
    certifications: source.certifications.map((cert) => ({
      ...cert,
      ...(t.certifications[cert.name] ?? {}),
    })),
  };
}
