"""Initial content, taken from the live portfolio (frontend/src/translations.js)
and the owner's public GitHub repositories.

Entries the owner named but that have no verified public detail yet (dates,
summaries) are created hidden / as drafts, so nothing unverified is published.
Runs once: it does nothing if a profile row already exists.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from models.entities import (
    Certification,
    Education,
    Experience,
    Project,
    SiteProfile,
    SkillCategory,
    SkillItem,
    utcnow,
)

ABOUT_BODY_EN = "\n\n".join(
    [
        "I develop backend applications using Python, FastAPI, Java, PostgreSQL, SQL, and REST APIs, with experience designing APIs, implementing backend logic, and building maintainable software solutions. I also have experience with JavaScript and React, enabling effective collaboration across the software development lifecycle.",
        "Through professional experience, academic coursework, and personal projects, I have strengthened my skills in software engineering, database design, object-oriented programming, data structures and algorithms, and collaborative development.",
        "I'm particularly interested in backend engineering, system design, cloud technologies, and AI-driven applications.",
    ]
)

PROFILE_TRANSLATIONS = {
    "fr": {
        "professional_title": "Ingénieur logiciel backend",
        "availability_text": "Disponible pour des opportunités backend",
        "hero_title": "Je construis les systèmes derrière",
        "hero_title_accent": "les logiciels utiles.",
        "hero_summary": "Bonjour, je suis Jean Claude Ishimwe — développeur backend passionné par la création de systèmes fiables et évolutifs pour résoudre des problèmes réels.",
        "about_title": "Un développeur orienté backend.",
        "about_lead": "Développeur backend chez SilverLandTech et étudiant en informatique à l'Université du Rwanda, passionné par les systèmes fiables et évolutifs.",
        "about_body": "\n\n".join(
            [
                "Je développe des applications backend avec Python, FastAPI, Java, PostgreSQL, SQL et les API REST. J'ai également de l'expérience avec JavaScript et React pour collaborer efficacement sur tout le cycle de développement.",
                "Mon expérience professionnelle, mes cours et mes projets ont renforcé mes compétences en génie logiciel, conception de bases de données, programmation orientée objet, structures de données et algorithmes.",
                "Je m'intéresse particulièrement à l'ingénierie backend, à la conception de systèmes, aux technologies cloud et aux applications basées sur l'IA.",
            ]
        ),
        "contact_intro": "Ouvert aux stages backend, programmes pour diplômés, postes de développeur backend junior et opportunités en génie logiciel.",
        "location": "Kigali, Rwanda",
    },
    "rw": {
        "professional_title": "Backend Software Engineer",
        "availability_text": "Niteguye amahirwe ya backend",
        "hero_title": "Nubaka sisitemu ziri inyuma ya",
        "hero_title_accent": "porogaramu zifite akamaro.",
        "hero_summary": "Ndi Jean Claude Ishimwe — Backend Developer ukunda kubaka sisitemu zizewe kandi zaguka, no gukemura ibibazo nyakuri akoresheje porogaramu.",
        "about_title": "Umwubatsi wibanda kuri backend.",
        "about_lead": "Ndi Backend Developer muri SilverLandTech kandi ndi umunyeshuri wa Computer Science muri University of Rwanda, nkunda kubaka sisitemu zizewe kandi zaguka.",
        "about_body": "\n\n".join(
            [
                "Nkoresha Python, FastAPI, Java, PostgreSQL, SQL na REST APIs mu kubaka porogaramu za backend. Mfite kandi uburambe muri JavaScript na React, bimfasha gukorana neza n’amatsinda atandukanye.",
                "Uburambe bwo ku kazi, amasomo n’imishinga byankomeje muri software engineering, database design, object-oriented programming, data structures na algorithms.",
                "Nshimishwa cyane n’inganda za backend, system design, cloud technologies na AI-driven applications.",
            ]
        ),
        "contact_intro": "Niteguye internships za backend, graduate programs, imyanya ya junior backend engineer n’andi mahirwe ya software engineering.",
        "location": "Kigali, Rwanda",
    },
}


def seed_initial_content(db: Session) -> bool:
    if db.scalar(select(SiteProfile.id)) is not None:
        return False

    db.add(
        SiteProfile(
            id=1,
            full_name="Jean Claude Ishimwe",
            professional_title="Backend Software Engineer",
            location="Kigali, Rwanda",
            is_available=True,
            availability_text="Available for backend opportunities",
            hero_title="Building the systems behind",
            hero_title_accent="useful software.",
            hero_summary="Hi, I'm Jean Claude Ishimwe — a Backend Developer passionate about building reliable, scalable backend systems and solving real-world problems through software.",
            about_title="A backend-minded builder.",
            about_lead="Backend Developer at SilverLandTech and Computer Science student at the University of Rwanda passionate about building reliable, scalable backend systems and creating technology that solves real-world problems.",
            about_body=ABOUT_BODY_EN,
            engineering_principles=[
                {"title": "Architecture", "body": "Clear boundaries, cohesive business logic, and maintainable service structure."},
                {"title": "Database engineering", "body": "Thoughtful schemas, relationships, and persistence shaped around the domain."},
                {"title": "API design", "body": "Explicit contracts and RESTful interfaces that frontend teams can work with."},
                {"title": "Engineering quality", "body": "An emphasis on reliability, authentication, and code that stays understandable."},
            ],
            contact_intro="Open to backend engineering internships, graduate programs, junior backend engineer roles, and software engineering opportunities.",
            email="claudeish88@gmail.com",
            phone="+250 783 326 529",
            whatsapp="+250783326529",
            social_links=[
                {"label": "GitHub", "url": "https://github.com/Tech2024ish"},
                {"label": "LinkedIn", "url": "https://www.linkedin.com/in/ishimwe-jean-claude-goslish/"},
            ],
            seo_title="Jean Claude Ishimwe | Backend Software Engineer",
            seo_description="Backend Software Engineer in Kigali building reliable, scalable systems with Python, FastAPI, Java, PostgreSQL, and REST APIs.",
            default_theme="dark",
            translations=PROFILE_TRANSLATIONS,
        )
    )

    groups = [
        ("Backend", {"fr": {"name": "Backend"}, "rw": {"name": "Backend"}}, ["Python", "FastAPI", "Java", "REST APIs", "PostgreSQL", "SQL"]),
        ("Frontend", {"fr": {"name": "Frontend"}, "rw": {"name": "Frontend"}}, ["JavaScript", "React", "HTML", "CSS"]),
        ("Tools", {"fr": {"name": "Outils"}, "rw": {"name": "Ibikoresho"}}, ["Git", "GitHub", "Postman", "Docker", "Kubernetes"]),
        (
            "Core concepts",
            {"fr": {"name": "Concepts"}, "rw": {"name": "Concepts"}},
            ["OOP", "Database Design", "API Design", "Authentication", "Data Structures", "Algorithms", "Software Engineering"],
        ),
    ]
    for position, (name, translations, skills) in enumerate(groups):
        category = SkillCategory(name=name, position=position, translations=translations)
        category.skills = [SkillItem(name=skill, position=i) for i, skill in enumerate(skills)]
        db.add(category)

    db.add_all(
        [
            Experience(
                organization="SilverLandTech",
                role="Backend Developer",
                is_current=True,
                period_label="May — Present",
                highlights=[
                    "Develop backend services using Python and FastAPI.",
                    "Design RESTful APIs, PostgreSQL schemas, and CRUD operations.",
                    "Build business logic and maintain clean, scalable backend architecture.",
                    "Collaborate with frontend developers on debugging and feature development.",
                ],
                skills=["Python", "FastAPI", "PostgreSQL"],
                position=0,
                translations={
                    "fr": {
                        "role": "Développeur backend",
                        "period_label": "Mai — Présent",
                        "highlights": [
                            "Développer des services backend avec Python et FastAPI.",
                            "Concevoir des API REST, des schémas PostgreSQL et des opérations CRUD.",
                            "Construire la logique métier et maintenir une architecture évolutive.",
                            "Collaborer avec les développeurs frontend pour le débogage et les fonctionnalités.",
                        ],
                    },
                    "rw": {
                        "period_label": "Gicurasi — Ubu",
                        "highlights": [
                            "Kubaka backend services ukoresheje Python na FastAPI.",
                            "Gukora REST APIs, PostgreSQL schemas na CRUD operations.",
                            "Kubaka business logic no kubungabunga architecture yaguka.",
                            "Gukorana na frontend developers mu gukemura ibibazo no kubaka features.",
                        ],
                    },
                },
            ),
            Experience(
                organization="Techinika",
                role="Technical Writer",
                period_label="January — September 2026",
                highlights=[
                    "Write technical articles and explain software engineering concepts.",
                    "Produce educational technical content in collaboration with editorial members.",
                ],
                skills=["Technical writing", "Software engineering"],
                position=1,
                translations={
                    "fr": {
                        "role": "Rédacteur technique",
                        "period_label": "Janvier — Septembre 2026",
                        "highlights": [
                            "Rédiger des articles techniques et expliquer des concepts de génie logiciel.",
                            "Produire du contenu éducatif avec les membres de la rédaction.",
                        ],
                    },
                    "rw": {
                        "period_label": "Mutarama — Nzeri 2026",
                        "highlights": [
                            "Kwandika articles za tekiniki no gusobanura software engineering.",
                            "Gukora content yigisha ku bufatanye n’abanditsi bagenzi.",
                        ],
                    },
                },
            ),
            # Confirmed roles without verified dates or details yet: hidden until completed in /admin.
            Experience(
                organization="GS Mutara",
                role="Teaching Assistant",
                employment_type="IEE / Mastercard Foundation",
                position=2,
                is_visible=False,
            ),
            Experience(
                organization="A2SV",
                role="Data Structures and Algorithms Trainee",
                position=3,
                is_visible=False,
            ),
        ]
    )

    db.add(
        Education(
            institution="University of Rwanda",
            degree="Bachelor of Science",
            field_of_study="Computer Science",
            status="In progress",
            period_label="Expected July 2028",
            position=0,
            translations={
                "fr": {"degree": "Licence (BSc)", "field_of_study": "Informatique", "status": "En cours", "period_label": "Fin prévue : juillet 2028"},
                "rw": {"status": "Ndacyiga", "period_label": "Biteganyijwe muri Nyakanga 2028"},
            },
        )
    )
    db.add_all(
        [
            Certification(name="Python Essentials", issuer="Cisco Networking Academy", position=0),
            Certification(name="HTML Essentials", issuer="Cisco Networking Academy", position=1),
        ]
    )

    now = utcnow()
    db.add_all(
        [
            Project(
                slug="school-management-system",
                title="School Management System",
                category="Backend & web app",
                summary="A school operations application covering student and teacher management, attendance, reports, and authentication.",
                tech_stack=["Java", "Hibernate", "MySQL", "JSF"],
                github_url="https://github.com/Tech2024ish/school-management-system",
                status="published",
                is_featured=True,
                published_at=now,
                position=0,
                translations={
                    "fr": {"title": "Système de gestion scolaire", "category": "Backend et web", "summary": "Application de gestion scolaire couvrant les étudiants, les enseignants, l'assiduité, les rapports et l'authentification."},
                    "rw": {"category": "Backend na web", "summary": "Porogaramu icunga abanyeshuri, abarimu, attendance, reports na authentication."},
                },
            ),
            Project(
                slug="mosaic",
                title="MOSAIC",
                category="Backend platform",
                summary="A supply-chain decision intelligence platform for mid-market distributors, starting with African distribution businesses. The current foundation is a modular-monolith FastAPI backend with PostgreSQL migrations; the decision engine is not implemented yet.",
                tech_stack=["Python", "FastAPI", "PostgreSQL", "Alembic", "React", "Docker"],
                github_url="https://github.com/Tech2024ish/mosaic",
                status="published",
                is_featured=True,
                published_at=now,
                position=1,
            ),
            Project(
                slug="portfolio-website",
                title="Portfolio Website",
                category="Full-stack project",
                summary="A responsive personal portfolio combining a React interface with a FastAPI backend, Supabase/PostgreSQL persistence, and an owner workspace for managing content.",
                tech_stack=["React", "FastAPI", "Supabase", "PostgreSQL"],
                github_url="https://github.com/Tech2024ish/portfolio-website",
                live_url="https://goslish.vercel.app",
                status="published",
                is_featured=True,
                published_at=now,
                position=2,
                translations={
                    "fr": {"title": "Site portfolio", "category": "Projet full-stack", "summary": "Portfolio personnel responsive avec React, FastAPI et une persistance Supabase/PostgreSQL."},
                    "rw": {"category": "Full-stack", "summary": "Portfolio ikoresha React, FastAPI na Supabase/PostgreSQL."},
                },
            ),
            Project(
                slug="buzhub-platform",
                title="BuzHub Platform",
                category="Backend contribution",
                summary="Backend development contribution focused on API design, business logic, and persistence for a platform built around real product needs.",
                tech_stack=["FastAPI", "PostgreSQL", "REST APIs"],
                status="published",
                published_at=now,
                position=3,
                translations={
                    "fr": {"title": "Plateforme BuzHub", "category": "Contribution backend", "summary": "Contribution backend centrée sur la conception d'API, la logique métier et la persistance."},
                    "rw": {"category": "Umusanzu wa backend", "summary": "Umusanzu wa backend wibanda kuri API design, business logic na persistence."},
                },
            ),
            # Named by the owner; details to be written in /admin before publishing.
            Project(slug="rwanda-electronics-ecommerce-api", title="Rwanda Electronics E-Commerce API", category="Backend API", position=4),
            Project(slug="imibereho", title="Imibereho", position=5),
            Project(slug="tondeai", title="TondeAI", position=6),
            Project(slug="codealpha-projects", title="CodeAlpha projects", position=7),
        ]
    )
    db.flush()
    return True
