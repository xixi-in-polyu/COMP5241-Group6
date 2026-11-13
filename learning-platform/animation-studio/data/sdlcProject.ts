import type { AnimationProject, CaptionMode, ElementType, NarrationSegment, Scene, SceneElement, SceneTemplate } from '../model/types';
import { CURRENT_SCHEMA_VERSION } from '../model/types';
import { createDefaultMotion } from '../model/motion';
import { defaultCaptionForTemplate, defaultVisualForType } from '../model/visual';

const sourceId = 'source-sdlc-lecture';

const narration = (sceneId: string, lines: string[], duration: number): NarrationSegment[] => {
  const narrationDuration = Math.max(1, duration - 1.2);
  const slice = narrationDuration / lines.length;
  return lines.map((text, index) => ({
    id: `${sceneId}-n${index + 1}`,
    text,
    start: Number((index * slice).toFixed(2)),
    end: Number(((index + 1) * slice).toFixed(2)),
  }));
};

const element = (
  id: string,
  type: ElementType,
  content: string,
  items: string[] | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  start: number,
  pages: number[],
  accent?: string,
  script: NarrationSegment[] = [],
): SceneElement => ({
  id,
  type,
  content,
  items: items?.map((label, index) => ({ id: `${id}-item-${index + 1}`, label })),
  x,
  y,
  width,
  height,
  style: { accent, tone: 'glass', align: type === 'title' ? 'left' : 'center' },
  motion: createDefaultMotion(id, type, script, { enter: type === 'flow' || type === 'timeline' ? 'draw' : 'rise', start, duration: 1.1 }),
  visual: defaultVisualForType(type),
  sourcePages: pages,
});

const scene = (
  id: string,
  chapterId: string,
  title: string,
  template: SceneTemplate,
  knowledgeNodeIds: string[],
  elements: SceneElement[],
  script: string[],
  duration: number,
  captionMode?: CaptionMode,
): Scene => {
  const narrationSegments = narration(id, script, duration);
  return {
    id,
    chapterId,
    title,
    template,
    duration,
    elements: elements.map((item) => {
      const motion = createDefaultMotion(item.id, item.type, narrationSegments, {
        enter: item.motion.enter.preset === 'draw' ? 'draw' : item.motion.enter.preset === 'spring-scale' ? 'scale' : 'rise',
        start: item.motion.enter.trigger.type === 'time' ? item.motion.enter.trigger.at : 0,
        duration: item.motion.enter.duration,
      });
      return {
        ...item,
        motion: {
          ...motion,
          exit: motion.exit ? {
            ...motion.exit,
            trigger: { type: 'time', at: duration - 0.55 },
            duration: 0.55,
          } : undefined,
        },
      };
    }),
    narration: narrationSegments,
    knowledgeNodeIds,
    transitionOut: { preset: 'fade', duration: 0.6 },
    captionMode: captionMode ?? defaultCaptionForTemplate(template),
  };
};

export const createSdlcProject = (): AnimationProject => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'project-sdlc-story',
  title: 'From Idea to Impact',
  description: 'A source-grounded, editable visual journey through the software development lifecycle.',
  locale: 'en-US',
  renderConfig: { fps: 30, width: 1920, height: 1080 },
  createdAt: '2026-10-31T00:00:00.000Z',
  updatedAt: '2026-10-31T00:00:00.000Z',
  sourceDocuments: [{
    id: sourceId,
    name: '2 - Software Development Lifecycle-1.pdf',
    mimeType: 'application/pdf',
    pageCount: 57,
    importedAt: '2026-10-31T00:00:00.000Z',
  }],
  knowledgeNodes: [
    ['sdlc', 'SDLC', 'A structured lifecycle from requirements through maintenance.', [2]],
    ['requirements', 'Requirements', 'Functional needs describe what; non-functional needs describe how well.', [3, 4, 17]],
    ['elicitation', 'Elicitation', 'Stakeholder discovery through documents, observation, interviews, surveys and prototypes.', [5, 7, 8, 10]],
    ['prototype', 'Prototype and MVP', 'Early artifacts test assumptions; an MVP maximizes validated learning with minimum effort.', [11, 12, 13, 14, 15, 16]],
    ['design', 'Design and architecture', 'Design translates what the system must do into how components work together.', [18, 19, 20]],
    ['security', 'Secret management', 'API keys stay outside source control and are injected into production.', [21, 22]],
    ['testing', 'Testing levels', 'Unit, integration, system, regression, automation and acceptance testing reduce different risks.', [23, 24, 25, 27, 28, 29]],
    ['validation', 'Verification and validation', 'Build the product right, then confirm it is the right product.', [30, 31, 32, 33, 34]],
    ['deployment', 'Deployment environments', 'Production differs from development in data, controls, dependencies and scale.', [35, 36]],
    ['maintenance', 'Maintenance', 'Corrective, adaptive, perfective and preventive work dominate lifecycle cost.', [37, 38, 39]],
    ['incident', 'Incident response', 'Discovery, mitigation and recovery determine operational impact.', [40, 41, 42, 43, 44, 45, 46]],
    ['availability', 'Availability', 'Uptime divided by uptime plus downtime, shaped by failures and recovery speed.', [47, 48]],
    ['strategies', 'Deployment strategies', 'Big bang, rolling, blue-green and canary releases trade speed against risk.', [51, 52, 53, 54, 55]],
    ['delivery', 'Feature flags and CI/CD', 'Controlled exposure and automated delivery help teams ship safely.', [56, 57]],
  ].map(([id, title, summary, sourcePages]) => ({
    id: String(id),
    kind: id === 'availability' ? 'formula' as const : 'concept' as const,
    title: String(title),
    summary: String(summary),
    sourceDocumentId: sourceId,
    sourcePages: sourcePages as number[],
  })),
  chapters: [
    { id: 'ch-overview', title: 'SDLC Overview', shortTitle: 'Overview', color: '#9FAF91' },
    { id: 'ch-discover', title: 'Requirements, Prototyping & MVP', shortTitle: 'Discover', color: '#C69483' },
    { id: 'ch-build', title: 'Design, Implementation & Security', shortTitle: 'Build', color: '#8EA6B4' },
    { id: 'ch-test', title: 'Testing, Verification & Validation', shortTitle: 'Test', color: '#A79AB7' },
    { id: 'ch-operate', title: 'Deployment, Maintenance & Reliability', shortTitle: 'Operate', color: '#8FAFA8' },
    { id: 'ch-ship', title: 'Release Strategies, Feature Flags & CI/CD', shortTitle: 'Ship', color: '#C8AA72' },
  ],
  scenes: [
    scene('scene-01', 'ch-overview', 'A product is a living system', 'opening', ['sdlc'], [
      element('s1-title', 'title', 'FROM IDEA\nTO IMPACT', undefined, 6, 10, 54, 28, 0, [1, 2], '#9FAF91'),
      element('s1-badge', 'badge', 'A living software journey', undefined, 6, 42, 28, 8, 2, [2]),
      element('s1-cycle', 'lifecycle', 'Software Development Lifecycle', ['Discover', 'Design', 'Build', 'Test', 'Deploy', 'Learn'], 61, 12, 34, 68, 5, [2], '#9FAF91'),
    ], [
      'Software is not born in a single moment. It moves from an uncertain idea to a system used by real people, under real pressure.',
      'The software development lifecycle, or SDLC, gives that journey structure. It connects requirements, design, implementation, testing, deployment, and maintenance.',
      'Our example is an AI tutor. Students ask questions, teachers shape the learning experience, and the team must turn both needs into dependable software.',
      'The path looks circular because every release creates feedback. What we learn in production becomes the next requirement, and the lifecycle begins again.',
    ], 58),
    scene('scene-02', 'ch-overview', 'One loop, many decisions', 'process', ['sdlc'], [
      element('s2-title', 'title', 'ONE LOOP.\nMANY DECISIONS.', undefined, 5, 7, 48, 23, 0, [2], '#9FAF91'),
      element('s2-flow', 'flow', 'The delivery loop', ['Requirements', 'System design', 'Implementation', 'Unit test', 'Integration', 'System test', 'Acceptance', 'Deployment', 'Maintenance'], 5, 38, 90, 32, 4, [2]),
      element('s2-text', 'text', 'Each stage reduces a different kind of uncertainty.', undefined, 56, 10, 37, 18, 8, [2]),
    ], [
      'A lifecycle is more than a checklist. Each stage answers a different question and reduces a different form of uncertainty.',
      'Requirements define the desired outcome. Design explains how the system will work. Implementation turns the design into executable behavior.',
      'Testing moves from small units to integrated modules, the complete system, and finally acceptance by customers or end users.',
      'Deployment puts the software into its real environment. Maintenance then fixes defects, adapts to change, improves quality, and prevents future problems.',
    ], 60),
    scene('scene-03', 'ch-discover', 'Start with the problem', 'concept', ['requirements', 'elicitation'], [
      element('s3-title', 'title', 'START WITH\nTHE PROBLEM', undefined, 5, 7, 48, 23, 0, [3, 7, 10], '#C69483'),
      element('s3-compare', 'comparison', 'Two kinds of requirements', ['FUNCTIONAL — What the system must do', 'NON-FUNCTIONAL — How well it must operate'], 5, 39, 58, 36, 3, [3, 4, 17]),
      element('s3-cards', 'cards', 'Listen before you specify', ['Document analysis', 'Observation', 'Interviews', 'Surveys', 'Focus groups', 'Prototyping'], 67, 11, 28, 40, 7, [5]),
    ], [
      'Good software begins with the problem, not with a favorite solution. Teams identify the people affected, learn their workflows, and uncover the value the project must create.',
      'Functional requirements describe what the system should accomplish: create an account, search content, or generate questions from a source text.',
      'Non-functional requirements describe how well it should work: its performance, reliability, availability, usability, scalability, security, and maintainability.',
      'Teams collect this evidence through documents, observation, interviews, surveys, workshops, and prototypes. Better questions expose pain points, exceptions, ownership, and conflicting priorities.',
    ], 68),
    scene('scene-04', 'ch-discover', 'Prototype to learn', 'comparison', ['prototype', 'elicitation'], [
      element('s4-title', 'title', 'PROTOTYPE\nTO LEARN', undefined, 5, 7, 44, 23, 0, [11, 14, 15], '#C69483'),
      element('s4-flow', 'flow', 'The learning loop', ['Idea', 'Build', 'Measure', 'Learn', 'Refine'], 5, 40, 52, 26, 3, [14, 15]),
      element('s4-cards', 'cards', 'Choose the right fidelity', ['Wireframe — structure', 'Mockup — visual language', 'High-fidelity — interaction', 'MVP — validated learning'], 62, 10, 33, 40, 7, [11, 12, 13, 14, 15, 16]),
    ], [
      'Stakeholders often recognize what they need only when they can see and try something. Prototypes make requirements tangible before the team commits to full production.',
      'A throwaway prototype is built quickly and discarded. An evolutionary prototype grows through feedback. An incremental prototype develops separate parts and later combines them.',
      'Wireframes test structure, mockups test visual language, and high-fidelity prototypes test interaction. Each is an instrument for learning, not automatically a finished product.',
      'A minimum viable product goes further. It delivers enough real value to test the business idea with real users, collect meaningful evidence, and guide the next investment.',
    ], 68),
    scene('scene-05', 'ch-build', 'Turn what into how', 'architecture', ['design'], [
      element('s5-title', 'title', 'TURN “WHAT”\nINTO “HOW”', undefined, 5, 7, 45, 23, 0, [18], '#8EA6B4'),
      element('s5-topology', 'topology', 'AI tutor architecture', ['React interface', 'Flask API', 'AI service', 'Chat database'], 7, 40, 86, 34, 3, [18, 19, 20]),
      element('s5-text', 'text', 'Requirements state the outcome. Design explains the system.', undefined, 55, 11, 38, 16, 7, [18]),
    ], [
      'Requirements state what the system should do. Design describes how it will do it, including components, data, interfaces, trade-offs, and responsibilities.',
      'For our AI tutor, a React interface lets students type questions and view answers. It sends requests to a Python Flask application programming interface.',
      'The backend applies business logic, calls the AI service, and stores chat history in a database. Clear interfaces let these parts evolve without becoming one tangled block.',
      'System design is the practice of reasoning about this structure: expected scale, failure modes, data movement, security boundaries, and the compromises required by real constraints.',
    ], 65),
    scene('scene-06', 'ch-build', 'Secrets stop at the boundary', 'process', ['security', 'design'], [
      element('s6-title', 'title', 'SECRETS STOP\nAT THE BOUNDARY', undefined, 5, 7, 51, 23, 0, [21, 22], '#8EA6B4'),
      element('s6-flow', 'flow', 'Safe secret path', ['Local .env', '.gitignore', 'Code-only repository', 'Deployment platform', 'Runtime injection'], 6, 40, 88, 27, 3, [21, 22]),
      element('s6-badge', 'badge', 'NEVER ship keys to the browser or repository', undefined, 58, 12, 35, 12, 7, [21, 22], '#C69483'),
    ], [
      'Implementation turns design into code, but production quality also depends on what the code refuses to expose. Secret keys are a simple and critical example.',
      'During local development, a dot-env file can provide environment variables. A git-ignore rule keeps that file and other sensitive material out of version control.',
      'The remote repository should contain code, never live credentials. In production, the hosting platform stores secrets and injects them only into the running backend.',
      'The browser must never receive a private AI key. It calls the backend, and the backend calls the protected service. That boundary is part of the architecture.',
    ], 60),
    scene('scene-07', 'ch-test', 'Test the seams', 'process', ['testing'], [
      element('s7-title', 'title', 'TEST\nTHE SEAMS', undefined, 5, 7, 39, 23, 0, [23, 24, 25], '#A79AB7'),
      element('s7-flow', 'flow', 'Confidence expands outward', ['Unit', 'Integration', 'System', 'Acceptance'], 5, 40, 56, 28, 3, [23, 24, 25, 29]),
      element('s7-cards', 'cards', 'Different tests, different risks', ['Function behavior', 'Module contracts', 'Complete requirements', 'Customer value'], 65, 10, 30, 40, 7, [23, 24, 25, 29]),
    ], [
      'Testing builds confidence from the inside out. Unit tests isolate a function, method, or class so a local fault is easy to identify.',
      'Integration testing combines modules. Two correct components can still fail when one misunderstands the other component’s interface, data, timing, or error behavior.',
      'System testing evaluates the complete product against its requirements, including functionality, recovery, interoperability, performance, scalability, reliability, and documentation.',
      'Acceptance testing asks customers or end users whether the delivered system satisfies agreed criteria. Alpha testing happens with developer support; beta testing reaches a broader real audience.',
    ], 66),
    scene('scene-08', 'ch-test', 'Right product. Built right.', 'comparison', ['testing', 'validation'], [
      element('s8-title', 'title', 'RIGHT PRODUCT.\nBUILT RIGHT.', undefined, 5, 7, 55, 23, 0, [33], '#A79AB7'),
      element('s8-compare', 'comparison', 'Verification vs. validation', ['VERIFICATION — Are we building the product right?', 'VALIDATION — Are we building the right product?'], 6, 39, 88, 27, 3, [30, 31, 32, 33, 34]),
      element('s8-badge', 'badge', 'Feedback creates the next requirement', undefined, 62, 12, 31, 11, 7, [34], '#9FAF91'),
    ], [
      'Verification evaluates development work against specifications. Code review, unit tests, integration tests, and system tests help confirm that the product is built correctly.',
      'Validation evaluates the product against user and business needs. Prototypes, usability studies, acceptance tests, production tests, and controlled experiments reveal whether it solves the right problem.',
      'Confirmation testing reruns a test that previously failed to prove a fix. Regression testing checks that a change has not broken behavior that used to work.',
      'Automation makes these checks repeatable, but it does not replace judgment. When teachers and students react to the AI tutor, their feedback creates new requirements and restarts the loop.',
    ], 68),
    scene('scene-09', 'ch-operate', 'Production changes the rules', 'incident', ['deployment', 'incident'], [
      element('s9-title', 'title', 'PRODUCTION\nCHANGES THE RULES', undefined, 5, 7, 52, 23, 0, [35, 36, 40], '#8FAFA8'),
      element('s9-timeline', 'timeline', 'A hidden degradation', ['01:00 deploy', '03:00 latency begins', '10:00 incident discovered', '13:00 root cause found', '21:00 service restored'], 5, 42, 90, 25, 3, [41, 42, 43, 44, 45, 46]),
      element('s9-text', 'text', 'Real data, real traffic, real consequences.', undefined, 61, 11, 33, 15, 7, [36, 40]),
    ], [
      'Deployment moves software into the customer environment. Production has different data, access controls, dependencies, resource limits, traffic patterns, and external services than development.',
      'Imagine a release at one in the morning. Health checks pass. At three, inefficient database queries begin exhausting resources, but no alert fires.',
      'The team discovers the incident at ten, correlates the slowdown with the deployment, finds the missing indexes, rewrites the queries, and verifies a patch in staging.',
      'At nine in the evening, production recovers. The technical fix matters, but so do the seven hours before discovery and the operational speed after the alarm.',
    ], 68, 'bottom'),
    scene('scene-10', 'ch-operate', 'Reliability is measurable', 'concept', ['maintenance', 'availability', 'incident'], [
      element('s10-title', 'title', 'RELIABILITY\nIS MEASURABLE', undefined, 5, 7, 47, 23, 0, [37, 38, 39, 46, 47], '#8FAFA8'),
      element('s10-formula', 'formula', 'AVAILABILITY', ['Uptime', '÷', 'Uptime + Downtime'], 5, 42, 47, 25, 3, [47]),
      element('s10-metrics', 'metrics', 'Operational signals', ['TTD · 7h', 'TTM · 8h', 'TTR · 18h', '99.99% · 52.6m/year'], 57, 36, 38, 35, 7, [46, 47, 48]),
    ], [
      'Availability is the proportion of time a system is functional: uptime divided by uptime plus downtime. More nines mean less tolerated interruption.',
      'Time to discover measures the visibility gap. Time to mitigate measures how quickly the team diagnoses and verifies a solution. Time to recover captures the total customer impact.',
      'Availability is shaped by hardware, networks, bugs, maintenance, security attacks, power, capacity, configuration, external providers, and backup recovery—not by code alone.',
      'Maintenance therefore dominates much of the lifecycle. Corrective work fixes defects; adaptive work follows environmental change; perfective work improves the product; preventive work reduces future risk.',
    ], 72, 'bottom'),
    scene('scene-11', 'ch-ship', 'Choose your risk envelope', 'comparison', ['strategies'], [
      element('s11-title', 'title', 'CHOOSE YOUR\nRISK ENVELOPE', undefined, 5, 7, 51, 23, 0, [51], '#C8AA72'),
      element('s11-cards', 'cards', 'Four ways to release', ['BIG BANG — all at once', 'ROLLING — replace gradually', 'BLUE–GREEN — switch environments', 'CANARY — start with a small audience'], 5, 37, 90, 24, 3, [52, 53, 54, 55]),
    ], [
      'A deployment strategy controls how much change reaches how many users at once. The best choice depends on business criticality, architecture, observability, and rollback speed.',
      'A big bang release replaces everything at once, often with downtime. It is simple to understand but concentrates risk and demands extensive testing.',
      'Rolling upgrades replace instances gradually. Blue-green deployment prepares a complete parallel environment, then moves traffic across and can quickly move it back.',
      'A canary release exposes only a small population first. If metrics remain healthy, the team expands the rollout. Each strategy defines a different risk envelope.',
    ], 62),
    scene('scene-12', 'ch-ship', 'Ship, observe, learn', 'closing', ['delivery', 'sdlc'], [
      element('s12-title', 'title', 'SHIP. OBSERVE.\nLEARN.', undefined, 5, 7, 51, 23, 0, [56, 57], '#C8AA72'),
      element('s12-flow', 'flow', 'Continuous delivery', ['Git commit', 'Build', 'Automated tests', 'Quality checks', 'Controlled rollout', 'Monitor', 'Feedback'], 5, 40, 90, 28, 3, [56, 57]),
      element('s12-badge', 'badge', 'The lifecycle never really ends', undefined, 63, 12, 31, 11, 7, [2, 34, 57], '#9FAF91'),
    ], [
      'Modern delivery connects version control to continuous integration and deployment. Every commit can trigger a build, automated tests, and code-quality checks.',
      'Feature flags separate deployment from release. Teams can ship dormant code, activate it for selected users, compare behavior, and turn it off without another deployment.',
      'After rollout, engineers watch reliability, latency, errors, and user outcomes. Production evidence closes the gap between the specification and the lived experience.',
      'The AI tutor began as a question, became a prototype, passed through architecture and tests, reached production, and generated new learning. That is why the lifecycle never really ends.',
    ], 65),
  ].map((item, index, all) => index === all.length - 1 ? { ...item, transitionOut: undefined } : item),
  assets: [],
  theme: {
    name: 'Morandi Paper',
    background: '#F4F1EB',
    surface: '#E7E1D8',
    foreground: '#303535',
    muted: '#737A78',
    accent: '#9FAF91',
    accentAlt: '#8EA6B4',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  },
});

export const sdlcProject = createSdlcProject();
