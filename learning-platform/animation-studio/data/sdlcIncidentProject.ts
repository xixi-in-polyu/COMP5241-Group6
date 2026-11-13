import type { AnimationProject, ElementType, NarrationSegment, Scene, SceneElement, SceneTemplate } from '../model/types';
import { CURRENT_SCHEMA_VERSION } from '../model/types';
import { createDefaultMotion } from '../model/motion';
import { defaultVisualForType } from '../model/visual';

const sourceId = 'source-sdlc-lecture';

const narration = (sceneId: string, lines: string[], duration: number): NarrationSegment[] => {
  const narrationDuration = duration - 4;
  const slice = narrationDuration / lines.length;
  return lines.map((text, index) => ({
    id: `${sceneId}-n${index + 1}`,
    text,
    start: Number((index * slice).toFixed(2)),
    end: Number(((index + 1) * slice).toFixed(2)),
  }));
};

type ElementOptions = {
  items?: string[];
  accent?: string;
  align?: 'left' | 'center' | 'right';
  assetId?: string;
  alt?: string;
  fit?: 'contain' | 'cover';
  enterAt?: number;
};

const element = (
  id: string,
  type: ElementType,
  content: string,
  x: number,
  y: number,
  width: number,
  height: number,
  pages: number[],
  options: ElementOptions = {},
): SceneElement => ({
  id,
  type,
  content,
  items: options.items?.map((label, index) => ({ id: `${id}-item-${index + 1}`, label })),
  x,
  y,
  width,
  height,
  style: { accent: options.accent, tone: 'light', align: options.align ?? (type === 'title' ? 'left' : 'center') },
  motion: createDefaultMotion(id, type, [], {
    enter: type === 'flow' || type === 'timeline' || type === 'topology' ? 'draw' : type === 'metrics' || type === 'formula' ? 'scale' : 'rise',
    start: options.enterAt ?? 0,
    duration: 0.9,
  }),
  visual: defaultVisualForType(type),
  sourcePages: pages,
  assetId: options.assetId,
  alt: options.alt,
  fit: options.fit,
});

const scene = (
  id: string,
  chapterId: string,
  title: string,
  template: SceneTemplate,
  knowledgeNodeIds: string[],
  elements: SceneElement[],
  lines: string[],
  duration: number,
): Scene => {
  const script = narration(id, lines, duration);
  return {
    id,
    chapterId,
    title,
    template,
    duration,
    knowledgeNodeIds,
    narration: script,
    captionMode: 'hidden',
    transitionOut: { preset: 'wipe', duration: 0.5 },
    elements: elements.map((item) => {
      const at = item.motion.enter.trigger.type === 'time' ? item.motion.enter.trigger.at : 0;
      const motion = createDefaultMotion(item.id, item.type, script, {
        enter: item.type === 'flow' || item.type === 'timeline' || item.type === 'topology' ? 'draw' : item.type === 'metrics' || item.type === 'formula' ? 'scale' : 'rise',
        start: at,
        duration: item.motion.enter.duration,
      });
      return {
        ...item,
        motion: {
          ...motion,
          ambient: item.type === 'image' || item.type === 'title' || item.type === 'text' ? 'none' : motion.ambient,
          exit: {
            id: `${item.id}-exit`,
            preset: 'slide',
            trigger: { type: 'time', at: duration - 0.7 },
            duration: 0.65,
            intensity: 0.7,
          },
        },
      };
    }),
  };
};

const imageAssets = [
  [5, 'requirements-methods.png', 'Requirements elicitation methods', { x: 0.04, y: 0.20, width: 0.92, height: 0.72 }],
  [15, 'mvp-learning-v2.png', 'MVP learning loop', { x: 0.66, y: 0.24, width: 0.31, height: 0.64 }],
  [19, 'architecture-v2.png', 'AI tutor architecture', { x: 0.03, y: 0.18, width: 0.94, height: 0.70 }],
  [22, 'secrets-path.png', 'Production secret path', { x: 0.02, y: 0.35, width: 0.96, height: 0.62 }],
  [33, 'verification-validation-v2.png', 'Verification and validation examples', { x: 0.04, y: 0.54, width: 0.92, height: 0.40 }],
  [34, 'feedback-loop.png', 'Product feedback loop', { x: 0.03, y: 0.28, width: 0.94, height: 0.62 }],
  [42, 'incident-hidden.png', 'Incident visibility gap', { x: 0.05, y: 0.38, width: 0.90, height: 0.55 }],
  [45, 'recovery-v2.png', 'Incident recovery', { x: 0.04, y: 0.54, width: 0.92, height: 0.40 }],
  [47, 'availability-v2.png', 'Availability formula and reliability clocks', { x: 0.04, y: 0.07, width: 0.92, height: 0.82 }],
  [52, 'deployment-big-bang.png', 'Big bang deployment topology', { x: 0.68, y: 0.13, width: 0.30, height: 0.70 }],
  [53, 'deployment-rolling.png', 'Rolling deployment topology', { x: 0.61, y: 0.06, width: 0.37, height: 0.78 }],
  [54, 'deployment-blue-green.png', 'Blue-green deployment topology', { x: 0.66, y: 0.05, width: 0.32, height: 0.86 }],
  [55, 'deployment-canary.png', 'Canary deployment topology', { x: 0.66, y: 0.05, width: 0.32, height: 0.80 }],
  [57, 'delivery-loop-v2.png', 'Continuous delivery workflow', { x: 0.62, y: 0.14, width: 0.35, height: 0.76 }],
] as const;

const sourcedAssets = imageAssets.map(([page, file, name, bbox]) => ({
  id: `asset-page-${String(page).padStart(3, '0')}`,
  name,
  kind: 'image' as const,
  uri: `source/sdlc-v3/${file}`,
  embedded: false,
  source: { documentId: sourceId, page, bbox, extraction: 'rendered-crop' as const },
}));

export const createSdlcIncidentProject = (): AnimationProject => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  id: 'project-sdlc-incident-v2',
  title: 'Eighteen Hours to Learn',
  description: 'An incident-led reconstruction of the software development lifecycle, grounded in the supplied lecture PDF.',
  locale: 'en-US',
  renderConfig: { fps: 30, width: 1920, height: 1080 },
  createdAt: '2026-11-04T00:00:00.000Z',
  updatedAt: '2026-11-04T00:00:00.000Z',
  sourceDocuments: [{
    id: sourceId,
    name: '2 - Software Development Lifecycle-1.pdf',
    mimeType: 'application/pdf',
    pageCount: 57,
    importedAt: '2026-11-04T00:00:00.000Z',
  }],
  knowledgeNodes: [
    ['incident', 'Production incident', 'A release can pass deployment checks and still degrade later under real load.', [40, 41, 42, 43, 44, 45, 46]],
    ['requirements', 'Requirements evidence', 'Requirements emerge from stakeholder workflows, constraints, and competing priorities.', [3, 4, 5, 7, 8, 10, 17]],
    ['prototype', 'Prototype and MVP', 'Early artifacts and minimum viable products reduce uncertainty before full investment.', [11, 12, 13, 14, 15, 16]],
    ['architecture', 'Architecture and boundaries', 'Design allocates responsibilities, interfaces, data movement, and security boundaries.', [18, 19, 20, 21, 22]],
    ['testing', 'Verification and validation', 'Testing expands from isolated units to customer value and production evidence.', [23, 24, 25, 27, 28, 29, 30, 31, 32, 33, 34]],
    ['reliability', 'Operational reliability', 'Detection, mitigation, recovery, and availability make production risk measurable.', [37, 38, 39, 46, 47, 48]],
    ['release', 'Risk-aware delivery', 'Deployment strategies, feature flags, CI/CD, and monitoring control release exposure.', [51, 52, 53, 54, 55, 56, 57]],
  ].map(([id, title, summary, sourcePages]) => ({
    id: String(id),
    kind: 'concept' as const,
    title: String(title),
    summary: String(summary),
    sourceDocumentId: sourceId,
    sourcePages: sourcePages as number[],
  })),
  chapters: [
    { id: 'ch-incident', title: 'Incident', shortTitle: '01:00–21:00', color: '#D84A3A' },
    { id: 'ch-rewind', title: 'Rewind', shortTitle: 'Before code', color: '#D9822B' },
    { id: 'ch-contain', title: 'Contain', shortTitle: 'Design & test', color: '#2563EB' },
    { id: 'ch-release', title: 'Release', shortTitle: 'Risk control', color: '#138A72' },
    { id: 'ch-learn', title: 'Learn', shortTitle: 'Feedback', color: '#8B5CF6' },
  ],
  scenes: [
    scene('scene-01', 'ch-incident', '01:00 — Green lights', 'incident', ['incident'], [
      element('s1-title', 'title', '01:00 · RELEASE LOOKS HEALTHY', 5, 8, 45, 14, [41, 42], { accent: '#D84A3A' }),
      element('s1-image', 'image', '', 53, 10, 42, 52, [42], { assetId: 'asset-page-042', alt: 'Lecture slide showing unnoticed production degradation', fit: 'contain', enterAt: 1.5 }),
      element('s1-badge', 'badge', 'GREEN PIPELINE ≠ HEALTHY PRODUCTION', 5, 27, 43, 12, [41, 42], { accent: '#D84A3A', enterAt: 3 }),
      element('s1-timeline', 'timeline', 'What customers experienced before the team knew', 5, 62, 90, 18, [41, 42], { items: ['01:00 · deploy passes', '03:00 · query load rises', '10:00 · humans discover it'], accent: '#D84A3A', enterAt: 5 }),
    ], [
      'At one in the morning, a new release reaches production. The deployment job is green, health checks pass, and the team goes home believing the change is finished.',
      'Two hours later, an inefficient query begins consuming database resources. Nothing crashes outright. Responses simply become slower, then slower again, while the dashboards remain quiet.',
      'This is the uncomfortable gap between deployment and reality. Software can be installed correctly yet still fail under real data, traffic, dependencies, and human behavior.',
      'We will use this eighteen-hour incident as a thread through the lifecycle and ask a practical question: which earlier decisions could have reduced the damage or shortened the silence?',
    ], 60),
    scene('scene-02', 'ch-incident', '10:00 — The invisible failure', 'incident', ['incident', 'reliability'], [
      element('s2-title', 'title', '10:00 · SEVEN HOURS WITHOUT A SIGNAL', 5, 8, 46, 14, [42, 46], { accent: '#D84A3A' }),
      element('s2-metrics', 'metrics', 'Four clocks expose four different failures', 5, 29, 44, 43, [46], { items: ['7h · customers suffer before detection', '8h · diagnosis and mitigation work', '18h · total customer impact', '0 · alerts that identified the cause'], accent: '#D84A3A', enterAt: 3 }),
      element('s2-image', 'image', '', 53, 18, 42, 58, [42], { assetId: 'asset-page-042', alt: 'Lecture slide visualizing the visibility gap before incident discovery', fit: 'contain', enterAt: 5 }),
    ], [
      'The team notices the problem at ten in the morning, seven hours after degradation began. That delay is time to discover: the period in which customers experience harm but operators lack a useful signal.',
      'Engineers compare application logs, database behavior, and the release timeline. They narrow the fault to queries introduced by the one o’clock deployment and find missing indexes under production load.',
      'The incident is not only a coding mistake. It is also a monitoring design problem, a capacity assumption, a deployment decision, and a missing feedback mechanism.',
      'A lifecycle is valuable because it distributes responsibility across those questions. Requirements, design, testing, deployment, and maintenance each remove a different kind of uncertainty.',
    ], 62),
    scene('scene-03', 'ch-incident', '21:00 — Recovery is evidence', 'incident', ['incident', 'reliability'], [
      element('s3-title', 'title', '21:00 · SERVICE RESTORED', 5, 8, 45, 14, [44, 45, 46], { accent: '#D84A3A' }),
      element('s3-image', 'image', '', 53, 10, 42, 52, [45], { assetId: 'asset-page-045', alt: 'Lecture slide showing the incident fix and service restoration', fit: 'contain', enterAt: 2 }),
      element('s3-timeline', 'timeline', 'Recovery was a chain of evidence, not one heroic fix', 5, 60, 90, 20, [41, 42, 43, 44, 45, 46], { items: ['Deploy v2', 'Latency climbs', 'Users report', 'Query isolated', 'Index + rewrite', 'Metrics recover'], accent: '#D84A3A', enterAt: 4 }),
    ], [
      'The team rewrites the problematic queries, adds the missing indexes, and verifies the patch in staging before touching production again.',
      'At nine in the evening, service metrics return to normal. Time to mitigate measures the work after discovery; time to recover captures the full customer impact from degradation to restoration.',
      'Recovery closes the outage, but it should not close the investigation. The logs, timing, decisions, and missed alerts are evidence about the system the team actually built.',
      'Now we rewind. Instead of treating the defect as one bad line of code, we trace backward through the lifecycle and find the decisions that shape risk long before a release begins.',
    ], 68),
    scene('scene-04', 'ch-rewind', 'Before code — Listen for constraints', 'concept', ['requirements'], [
      element('s4-image', 'image', '', 4, 11, 55, 63, [5], { assetId: 'asset-page-005', alt: 'Lecture slide illustrating six methods for collecting requirements', fit: 'contain' }),
      element('s4-title', 'title', 'BEFORE CODE · FIND THE CONSTRAINT', 62, 9, 33, 14, [3, 5, 7, 10, 17], { accent: '#D9822B', enterAt: 1 }),
      element('s4-cards', 'cards', 'Each method reveals a different kind of evidence', 62, 29, 33, 43, [5, 7, 10], { items: ['Observe workarounds and hand-offs', 'Interview goals, ownership, and conflict', 'Study policies, logs, and existing data', 'Prototype exceptions before specification'], accent: '#D9822B', enterAt: 4 }),
    ], [
      'Good requirements work begins before anyone writes a backlog item. Teams identify who is affected, observe actual workflows, and ask where failure would create real cost.',
      'Functional requirements describe what the system must do. Non-functional requirements describe how well it must operate: performance, availability, reliability, scalability, security, usability, and maintainability.',
      'For the incident system, a requirement such as handle expected peak traffic is not decoration. It shapes data design, test environments, monitoring thresholds, and rollback decisions.',
      'Documents, observation, interviews, surveys, workshops, and prototypes reveal different evidence. The goal is not to collect every request; it is to expose constraints, conflicts, ownership, and exceptions early.',
    ], 65),
    scene('scene-05', 'ch-rewind', 'Prototype the risky assumption', 'comparison', ['prototype'], [
      element('s5-title', 'title', 'PROTOTYPE THE EXPENSIVE GUESS', 5, 9, 42, 14, [11, 14, 15], { accent: '#D9822B' }),
      element('s5-compare', 'comparison', 'Two artifacts, two different questions', 5, 29, 42, 43, [11, 13, 14, 15], { items: ['PROTOTYPE — Can people understand and use this idea? Cheap to change; may be discarded.', 'MVP — Will real users obtain enough value to produce product evidence?'], accent: '#D9822B', enterAt: 3 }),
      element('s5-image', 'image', '', 51, 12, 44, 61, [15], { assetId: 'asset-page-015', alt: 'Lecture slide comparing prototypes and minimum viable products', fit: 'contain', enterAt: 5 }),
    ], [
      'When uncertainty is high, the cheapest useful artifact is often not production code. A prototype lets stakeholders react to structure, interaction, or behavior while change is still inexpensive.',
      'Throwaway prototypes answer a narrow question and are discarded. Evolutionary prototypes grow through feedback. Incremental prototypes explore separate parts before the system is assembled.',
      'A minimum viable product goes further by placing enough real value in front of real users to test a business or product assumption.',
      'The important distinction is purpose. A prototype reduces ambiguity; an MVP produces market evidence. Neither automatically proves production readiness, reliability, security, or operational scale.',
    ], 65),
    scene('scene-06', 'ch-contain', 'Design is risk allocation', 'architecture', ['architecture'], [
      element('s6-title', 'title', 'DESIGN DECIDES WHERE FAILURE STOPS', 5, 8, 45, 14, [18, 19, 20], { accent: '#2563EB' }),
      element('s6-image', 'image', '', 52, 9, 43, 55, [19], { assetId: 'asset-page-019', alt: 'Lecture architecture diagram for a generative AI chat application', fit: 'contain', enterAt: 2 }),
      element('s6-topology', 'topology', 'A boundary is useful only when its contract is explicit', 5, 31, 43, 40, [18, 19, 20], { items: ['UI · input and feedback', 'API · policy and validation', 'AI · latency and rate limits', 'DB · durable conversation state'], accent: '#2563EB', enterAt: 4 }),
    ], [
      'Requirements state the outcome. Design allocates responsibility: which component owns data, which interface crosses a trust boundary, and which failure can be contained without taking down the whole product.',
      'In the lecture’s AI tutor, the browser presents the experience, a backend applies application logic, an AI service generates responses, and a database stores conversation history.',
      'Those boxes matter less than their contracts. Timeouts, retries, data validation, rate limits, logging, and failure behavior determine how the system behaves when one dependency slows down.',
      'Architecture is therefore not a polished diagram after the fact. It is a set of decisions about scale, coupling, security, observability, and the cost of change.',
    ], 66),
    scene('scene-07', 'ch-contain', 'Secrets define the boundary', 'process', ['architecture'], [
      element('s7-image', 'image', '', 4, 11, 50, 63, [22], { assetId: 'asset-page-022', alt: 'Lecture slide showing secret injection from local development to production', fit: 'contain' }),
      element('s7-title', 'title', 'SECURITY BOUNDARY · THE BROWSER IS NOT A VAULT', 57, 9, 38, 14, [21, 22], { accent: '#2563EB' }),
      element('s7-flow', 'flow', 'The secret moves only through controlled server-side boundaries', 57, 29, 38, 43, [21, 22], { items: ['Local .env · developer only', '.gitignore · never commit', 'Repository · code without keys', 'Platform store · rotate and audit', 'Backend runtime · inject at execution'], accent: '#2563EB', enterAt: 3 }),
    ], [
      'A small implementation choice can reveal whether the architecture has a real security boundary. Private keys must never be committed to a repository or shipped into browser code.',
      'During local development, environment variables can come from a dot-env file. Git ignore rules prevent that file from entering version control.',
      'In production, the deployment platform stores secrets and injects them into the backend process. The browser calls the backend; the backend calls the protected AI service.',
      'This is more than credential hygiene. It demonstrates a general rule: sensitive authority belongs behind a controlled interface where access, logging, rotation, and failure can be managed.',
    ], 58),
    scene('scene-08', 'ch-contain', 'Test the seams, then the promise', 'process', ['testing'], [
      element('s8-title', 'title', 'TEST OUTWARD · FROM LOGIC TO USER VALUE', 5, 8, 48, 14, [23, 24, 25, 29, 33], { accent: '#2563EB' }),
      element('s8-flow', 'flow', 'Every layer catches a different escape route', 5, 29, 44, 43, [23, 24, 25, 29], { items: ['Unit · local logic and edge cases', 'Integration · data and interface contracts', 'System · load, recovery, security', 'Acceptance · the promised user outcome'], accent: '#2563EB', enterAt: 3 }),
      element('s8-image', 'image', '', 53, 18, 42, 58, [33], { assetId: 'asset-page-033', alt: 'Lecture slide comparing verification and validation', fit: 'contain', enterAt: 5 }),
    ], [
      'Unit tests isolate local behavior so faults are easy to locate. They are necessary, but they cannot prove that two modules agree on data, timing, error handling, or interface contracts.',
      'Integration testing examines those seams. System testing evaluates the complete product against functional and non-functional requirements, including recovery, performance, scalability, reliability, and documentation.',
      'Acceptance testing asks whether users and customers recognize the promised value. Verification asks whether the product was built right; validation asks whether the right product was built.',
      'For our incident, realistic load, production-like data, query monitoring, and failure injection could have exposed the risk earlier. The test plan must reflect the system’s real operating conditions.',
    ], 68),
    scene('scene-09', 'ch-release', 'Reliability needs a clock', 'concept', ['reliability'], [
      element('s9-image', 'image', '', 4, 11, 50, 63, [47], { assetId: 'asset-page-047', alt: 'Lecture slide defining system availability and reliability metrics', fit: 'contain' }),
      element('s9-title', 'title', 'RELIABILITY · MEASURE THE SILENCE', 57, 8, 38, 14, [46, 47, 48], { accent: '#138A72' }),
      element('s9-metrics', 'metrics', 'A percentage becomes actionable only when tied to clocks', 56, 29, 39, 43, [46, 47], { items: ['7h · discover: alerting gap', '8h · mitigate: diagnosis + fix', '18h · recover: customer impact', '99.99% · target: ≈52 min/year'], accent: '#138A72', enterAt: 3 }),
    ], [
      'Availability is uptime divided by uptime plus downtime. The formula is simple; achieving it is not. Hardware, networks, software defects, configuration, external providers, capacity, security, and recovery all shape the result.',
      'Time to discover measures how long the system can hurt users without producing an actionable signal. Time to mitigate measures diagnosis and solution work. Time to recover captures total customer impact.',
      'The incident’s seven-hour visibility gap is a design failure expressed as a metric. Better telemetry, thresholds, traces, and ownership could have shortened it.',
      'Reliability work becomes concrete when teams connect service objectives to alerts, runbooks, rollback paths, and post-incident actions rather than treating availability as an abstract percentage.',
    ], 70),
    scene('scene-10', 'ch-release', 'A release is a risk envelope', 'comparison', ['release'], [
      element('s10-title', 'title', 'RELEASE STRATEGIES · HOW TRAFFIC MOVES', 5, 7, 90, 12, [51, 52, 53, 54, 55], { accent: '#138A72' }),
      element('s10-big-bang-image', 'image', '', 3, 20, 22, 45, [52], { assetId: 'asset-page-052', alt: 'Big bang deployment routes all users from version 1 to version 2 at once', fit: 'contain', enterAt: 2 }),
      element('s10-big-bang-text', 'text', 'ALL USERS SWITCH TOGETHER — simple, but downtime and rollback risk are concentrated.', 3, 66, 22, 12, [52], { accent: '#138A72', enterAt: 4 }),
      element('s10-rolling-image', 'image', '', 27, 20, 22, 45, [53], { assetId: 'asset-page-053', alt: 'Rolling deployment gradually replaces version 1 instances with version 2', fit: 'contain', enterAt: 16 }),
      element('s10-rolling-text', 'text', 'OLD + NEW COEXIST — capacity changes gradually; compatibility matters during the overlap.', 27, 66, 22, 12, [53], { accent: '#138A72', enterAt: 18 }),
      element('s10-blue-green-image', 'image', '', 51, 20, 22, 45, [54], { assetId: 'asset-page-054', alt: 'Blue-green deployment switches traffic between two complete environments', fit: 'contain', enterAt: 31 }),
      element('s10-blue-green-text', 'text', 'TWO FULL ENVIRONMENTS — test green, switch traffic, and route back to blue for fast rollback.', 51, 66, 22, 12, [54], { accent: '#138A72', enterAt: 33 }),
      element('s10-canary-image', 'image', '', 75, 20, 22, 45, [55], { assetId: 'asset-page-055', alt: 'Canary deployment routes a small audience to version 2 before expansion', fit: 'contain', enterAt: 47 }),
      element('s10-canary-text', 'text', 'SMALL AUDIENCE FIRST — expand only while errors, latency, and product signals remain healthy.', 75, 66, 22, 12, [55], { accent: '#138A72', enterAt: 49 }),
    ], [
      'Deployment strategy decides how much change reaches how many users before the team has production evidence. That makes it a risk-allocation decision, not merely a release checklist.',
      'Big bang deployment is simple but concentrates exposure. Rolling upgrades replace capacity gradually. Blue-green deployment prepares a parallel environment and makes rollback a traffic switch.',
      'Canary deployment begins with a small audience and expands only when service and product signals remain healthy.',
      'No strategy is universally best. The choice depends on architecture, business criticality, observability, database compatibility, rollback speed, and the cost of running parallel capacity.',
    ], 70),
    scene('scene-11', 'ch-release', 'Ship through gates, not hope', 'process', ['release'], [
      element('s11-title', 'title', 'DELIVERY PIPELINE · EVIDENCE BEFORE EXPOSURE', 5, 8, 48, 14, [56, 57], { accent: '#138A72' }),
      element('s11-flow', 'flow', 'Every gate answers a question before more users are exposed', 5, 29, 48, 43, [56, 57], { items: ['Commit · what changed?', 'Build · is it reproducible?', 'Tests · does behavior hold?', 'Gate · is quality acceptable?', 'Flag · who can see it?', 'Canary · what happens in reality?', 'Monitor · expand or stop?'], accent: '#138A72', enterAt: 3 }),
      element('s11-image', 'image', '', 57, 13, 38, 62, [57], { assetId: 'asset-page-057', alt: 'Lecture slide showing how large technology companies ship code to production', fit: 'contain', enterAt: 5 }),
    ], [
      'Continuous integration connects each commit to a repeatable build, automated tests, and code-quality checks. The pipeline turns evidence into a condition for progressing toward production.',
      'Feature flags separate deployment from release. Code can be present but inactive, enabled for selected users, compared against a baseline, and disabled without another deployment.',
      'A controlled rollout then watches reliability, latency, errors, and user outcomes. If the signals disagree with expectations, the system should stop or roll back automatically.',
      'The purpose is not maximum automation. It is fast, trustworthy feedback with clear human ownership when judgment is required.',
    ], 64),
    scene('scene-12', 'ch-learn', 'The postmortem becomes a requirement', 'closing', ['incident', 'requirements', 'release'], [
      element('s12-title', 'title', 'POSTMORTEM · TURN THE OUTAGE INTO THE NEXT REQUIREMENT', 5, 8, 52, 14, [34, 46, 57], { accent: '#8B5CF6' }),
      element('s12-image', 'image', '', 56, 18, 39, 56, [34], { assetId: 'asset-page-034', alt: 'Lecture slide showing the software feedback loop', fit: 'contain', enterAt: 2 }),
      element('s12-cycle', 'lifecycle', 'Evidence becomes the next design input', 5, 29, 47, 45, [2, 34, 46, 57], { items: ['Observe impact', 'Explain causes', 'Prioritize risk', 'Design controls', 'Test reality', 'Release gradually'], accent: '#8B5CF6', enterAt: 4 }),
    ], [
      'A useful postmortem does not stop at the faulty query. It records the conditions that allowed the defect to escape, the signals that failed to fire, and the decisions that made recovery slower.',
      'Those findings become new requirements: production-like performance tests, index checks, service-level alerts, query budgets, a canary stage, and a rehearsed rollback path.',
      'The system is maintained through corrective, adaptive, perfective, and preventive work. Production evidence changes what the team knows, so it must change what the team builds next.',
      'That is the software development lifecycle in practice: not a one-way sequence, but a disciplined loop that converts uncertainty into evidence and evidence into safer decisions.',
    ], 64),
  ].map((item, index, all) => index === all.length - 1 ? { ...item, transitionOut: undefined } : item),
  assets: [
    ...sourcedAssets,
  ],
  theme: {
    name: 'Classroom Field Notes',
    background: '#FFFDF7',
    surface: '#FFFFFF',
    foreground: '#24313A',
    muted: '#65737C',
    accent: '#D84A3A',
    accentAlt: '#2563EB',
    fontFamily: 'Inter, Arial, sans-serif',
  },
});
