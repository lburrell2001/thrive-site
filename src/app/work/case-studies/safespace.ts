import type { CaseStudy } from "../caseStudies";

const IMG = "/case-studies/safespace";

const study: CaseStudy = {
  slug: "safespace",
  client: "SafeSpace",
  headline: "A safe space patients can open their eyes into",
  lede:
    "SafeSpace is a two-part therapy tool for hypnotherapy sessions: a virtual reality space each patient builds for themselves, and an iPad app where the therapist keeps session notes. Lauren led the five-person team that planned and built it, and designed and developed the therapist app.",
  meta: [
    { label: "Project", value: "Senior design project (not client work)" },
    { label: "Type", value: "VR + iPad product concept for hypnotherapy" },
    { label: "Lauren's role", value: "Team leader, UX research, iPad app design and development" },
    { label: "Timeline", value: "Oct 2022 – Apr 2023; brand refreshed Feb 2025" },
  ],
  heroImage: {
    src: "storage:work/safespace-cover.jpg",
    alt: "A VR headset showing a moon landscape beside a phone with the green SafeSpace sign-in screen",
  },
  numbers: [
    { value: "2", label: "Connected apps: a VR space for patients, an iPad app for therapists" },
    { value: "3", label: "VR environments: a forest, a house and the moon" },
    { value: "5", label: "Therapist app screens designed" },
    { value: "5", label: "People on the team" },
  ],
  about: [
    "In hypnotherapy, a therapist asks the patient to picture a \"safe space\" — a beach, a house, a place in the mountains — and uses it as an anchor. When a memory gets too heavy, the patient is told to go back there.",
    "Therapists noticed that some patients can't. Under stress they lose the picture, and with it the anchor. SafeSpace was built around that one problem: instead of re-imagining the space, the patient opens their eyes inside a VR headset and is already there.",
  ],
  challenge: {
    intro:
      "The idea only works if both people in the room are served. The patient needs a space that feels like theirs. The therapist needs to take notes without breaking the session, and patient records have to stay private.",
    goals: [
      { title: "Make the space the patient's own", text: "Patients choose an indoor or outdoor environment and arrange furniture, plants and decor in it, then save it to return to." },
      { title: "Keep the therapist in the session", text: "A simple notes screen the therapist can use while the patient is in the headset, with a session timer." },
      { title: "Protect patient records", text: "Separate sign-ins for therapists and office administrators. Administrators can view session notes but cannot edit them." },
      { title: "Tie it together", text: "One database holds each patient's saved space and their therapist's notes, so both apps read from the same place." },
    ],
  },
  approach: {
    intro: "The project ran over two semesters, from proposal to a working build.",
    steps: [
      { title: "Research", text: "Lauren spoke with certified hypnotherapists and with patients about the moment the safe space slips away, and reviewed existing VR therapy products such as Amelia VR and AppliedVR. None of them let patients build their own space for use inside a session." },
      { title: "Requirements and use cases", text: "The team defined who does what — therapist, patient, administrator — and mapped each task in use-case and sequence diagrams, including where a sign-in is required." },
      { title: "System design", text: "A model-view-controller layout with the database at the center: the Unity VR space and the therapist app both read and write through it." },
      { title: "Therapist app wireframes", text: "First screens for sign-in, session notes, the administrator's patient roster, the therapist's roster and a patient's history of notes." },
      { title: "Build", text: "Teammates built the Unity environments, player movement, inventory and object grid. Lauren designed and developed the iPad app in Swift and connected it to a MongoDB database hosted on AWS, with create and read working for patients and therapists." },
      { title: "Brand refresh", text: "In February 2025 Lauren gave SafeSpace a full identity — a soft, inflated 3D wordmark, an app icon, a green palette and brand guidelines — and redesigned the iPad screens to match." },
    ],
  },
  showcase: [
    {
      title: "The VR spaces",
      text: "Three environments from the Unity build. Save and Inventory buttons sit in the corner, so a patient can add items and keep their space for the next session.",
      layout: "wide",
      images: [
        { src: "storage:projects/safespace/gallery/1.jpg", alt: "A night-time forest clearing in VR with large trees, purple flowers and Save and Inventory buttons" },
        { src: "storage:projects/safespace/gallery/2.jpg", alt: "A furnished open-plan house interior in VR with a wood-beamed ceiling, dining table, sofas and a TV" },
        { src: "storage:projects/safespace/gallery/3.jpg", alt: "A VR moon surface with Earth rising over the horizon and Save and Inventory buttons" },
      ],
    },
    {
      title: "Therapist app: first wireframes",
      text: "The first screens for the therapist side, drawn on a laptop frame before the app moved to iPad. Every name and date is sample data.",
      layout: "grid",
      images: [
        { src: `${IMG}/wire-login.webp`, alt: "SafeSpace sign-in screen with username and password fields", caption: "Sign in" },
        { src: `${IMG}/wire-session-notes.webp`, alt: "Session notes screen with the patient's name, a heart-rate line, a running timer, a notes box and Save", caption: "Session notes" },
        { src: `${IMG}/wire-admin-roster.webp`, alt: "Administrator roster table listing patient name, birth date and therapist", caption: "Administrator roster" },
        { src: `${IMG}/wire-therapist-roster.webp`, alt: "Therapist roster table listing patient name, birth date and gender", caption: "Therapist roster" },
        { src: `${IMG}/wire-patient-view.webp`, alt: "Patient view listing dated session notes, each with a View link", caption: "Patient history" },
      ],
    },
    {
      title: "How the pieces connect",
      text: "The database sits at the center. The Unity app saves and loads each patient's space; the iPad app manages therapists, patients and notes.",
      layout: "grid",
      images: [
        { src: `${IMG}/system-architecture.webp`, alt: "Early system diagram: Apple Watch health app and patient info feed the doctor application, which saves to the database alongside the Unity VR space" },
        { src: `${IMG}/database-diagram.webp`, alt: "Database diagram: a SafeSpace database with Therapists and Patients collections, and the calls used by the Unity app and the iPadOS app" },
      ],
    },
    {
      title: "The 2025 identity",
      text: "A soft, inflated wordmark and a bright green meant to read as calm and healing, carried into the iPad notes screens.",
      layout: "grid",
      images: [
        { src: `${IMG}/wordmark.webp`, alt: "The SafeSpace wordmark in glossy, inflated green 3D letters" },
        { src: `${IMG}/app-icon.webp`, alt: "SafeSpace app icon: a glossy green 3D letter S on a dark green rounded square" },
        { src: `${IMG}/ipad-notes.webp`, alt: "Two iPads with the redesigned dark green app; the front one lists a patient's dated session notes" },
      ],
    },
  ],
  features: [
    { title: "Build-your-own space", text: "Patients pick an environment and drag furniture, plants and decor into it. The space is saved, so it is waiting for them in the next session." },
    { title: "Session notes", text: "The therapist writes notes while the patient is in the headset, next to a running session timer." },
    { title: "Rosters by role", text: "Each therapist sees only their own patients. Administrators see every patient in the practice and which therapist they see." },
    { title: "Read-only for administrators", text: "Administrators can read session notes and update patient details, but only the therapist can edit notes." },
    { title: "Heart rate (planned)", text: "The design called for an Apple Watch to stream the patient's heart rate to the therapist's screen, so they could tie reactions to topics." },
  ],
  design: {
    intro:
      "Calm, supportive and a little playful: soft rounded forms and a green palette chosen for healing and clarity, kept simple so nothing on screen competes with the session.",
    colors: [
      { name: "Vibrant green", hex: "#00FF00" },
      { name: "Deep green", hex: "#004400" },
      { name: "Soft neutral", hex: "#D4EAD4" },
      { name: "Light gray", hex: "#DBD9DB" },
      { name: "Muted gray", hex: "#747572" },
    ],
    type: "A custom soft, inflated 3D lettering for the wordmark and headlines, paired with a clean sans-serif for body text, therapist notes and interface labels.",
    patterns: [
      { title: "Inflated 3D lettering", text: "The wordmark looks soft enough to touch, echoing the immersive VR side of the product." },
      { title: "Dark green screens", text: "The iPad app runs on deep green so it stays quiet in a dim therapy room." },
      { title: "Plain lists", text: "Notes are a simple dated list with one action per row, so the therapist never hunts for a button mid-session." },
    ],
  },
  timeline: [
    { when: "Oct 2022", title: "Proposal", text: "Research into hypnotherapy and existing VR therapy tools, the two-part system and its requirements." },
    { when: "Dec 2022", title: "Design document", text: "Use cases, sequence diagrams, system architecture and the first therapist-app screens." },
    { when: "Feb 2023", title: "Database and connections", text: "A MongoDB database set up on AWS; the Unity environments being connected." },
    { when: "Mar 2023", title: "Midterm", text: "Unity environments, menus, physics, movement, inventory and the object grid done; create and read for patients and therapists working; notes and client-log pages in progress." },
    { when: "Apr 2023", title: "Final report", text: "The two apps and database documented with a user guide. Store release was out of scope." },
    { when: "Feb 2025", title: "Brand refresh", text: "A new identity, brand guidelines and redesigned iPad screens." },
  ],
  outcome: [
    "SafeSpace reached a working build: three walkable VR environments with Save and Inventory controls, an iPad app for therapists, and a shared database behind both. It was not released to the Oculus or App Store.",
    "For Lauren it was a lesson in designing for two people in one room — the patient who needs to feel safe and the therapist who needs to keep working — and in letting one real problem drive every decision.",
  ],
  stack: ["Unity", "Swift", "Xcode", "MongoDB", "AWS", "Figma", "Photoshop", "Illustrator"],
};

export default study;
