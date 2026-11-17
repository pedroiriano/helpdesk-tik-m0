// js/modules/detail-pages.js — canonical detail catalog plus legacy-page enhancer
function createDetailCatalog() {
  const IMAGES = {
    finishing: 'assets/images/ball-01.jpg',
    handles: 'assets/images/ball-02.jpg',
    shooting: 'assets/images/ball-03.jpg',
    footwork: 'assets/images/ball-04.jpg'
  };

  function play(id, title, category, model, metric, secondary, seed, summary) {
    const image = IMAGES[category];
    const categoryLabel = {
      finishing: 'Finishing',
      handles: 'Handles & Iso',
      shooting: 'Shooting Lab',
      footwork: 'Footwork & Grip'
    }[category];

    return {
      id,
      eyebrow: `${categoryLabel} / ${model}`,
      title,
      summary,
      image,
      alt: `${title} basketball telemetry frame`,
      caption: `Trace ${seed} · illustrative performance frame`,
      stats: [
        ['Pipeline', model],
        ['Primary Metric', metric],
        ['Secondary', secondary],
        ['Trace ID', seed]
      ],
      prose: [
        `${title} isolates one repeatable basketball action so coaches can compare technique without losing the original frame context. The values shown here are illustrative product-demo telemetry, not a medical or eligibility assessment.`,
        `The ${model} workflow keeps the source frame, measurement window, and coaching cue together. A production deployment must calibrate the selected cameras and validate tolerance against the intended court environment.`
      ],
      specs: [
        ['Analysis class', categoryLabel],
        ['Evidence model', 'Frame-linked telemetry'],
        ['Primary reading', metric],
        ['Review mode', 'Coach-confirmed comparison']
      ],
      steps: [
        'Lock the start and finish frames around the movement being evaluated.',
        `Resolve the action through ${model} and retain the source-frame reference.`,
        'Translate the reading into one concise, athlete-readable coaching cue.',
        'Repeat the drill under the same calibration and compare the new trace.'
      ],
      primary: ['Discuss this play', `contact.html?topic=general&play=${encodeURIComponent(id)}`]
    };
  }

  const catalog = {
    pipeline: {
      page: 'pipeline.html',
      directory: 'pipelines',
      origin: ['Landing page', 'index.html#pipelines'],
      records: [
        {
          id: 'shooting', eyebrow: 'Pipeline 01 / shot-engine-v3', title: 'Shooting Lab',
          summary: 'Frame-linked analysis for release timing, entry geometry, and repeatable shooting mechanics.',
          image: IMAGES.shooting, alt: 'Shooting guard releasing a high-arc jump shot', caption: 'Shot engine · release-to-entry evidence chain',
          stats: [['Reference Arc', '45.2°'], ['Release', '0.68s'], ['Spin Baseline', '2,400 RPM'], ['Output', 'Coach-ready cue']],
          prose: ['Shooting Lab organizes release, flight, and entry readings around the exact video frames that produced them. Coaches can inspect the evidence before accepting a cue.', 'The displayed values are illustrative. Production accuracy depends on camera placement, frame rate, lens profile, court calibration, and validation against the intended training environment.'],
          specs: [['Input', 'Standard or high-speed court video'], ['Model', 'shot-engine-v3'], ['Trace', 'Frame, timestamp, release and entry window'], ['Governance', 'Athlete consent and retention policy required']],
          steps: ['Calibrate rim, court lines, and camera perspective.', 'Detect the gather, release, apex, and entry windows.', 'Compare the trace with the athlete’s own validated baseline.', 'Deliver one correction and verify it on the next rep.'],
          primary: ['View shooting plays', 'gallery.html?filter=shooting']
        },
        {
          id: 'handles', eyebrow: 'Pipeline 02 / iso-track-v2', title: 'Handle & ISO',
          summary: 'Movement analysis for pace changes, lateral separation, hip depth, and braking control.',
          image: IMAGES.handles, alt: 'Basketball player executing a low crossover', caption: 'ISO track · entry, shift, separation',
          stats: [['Entry', '18.4 mph'], ['Shift', '0.12s'], ['Brake Force', '2.8G'], ['Output', 'Separation trace']],
          prose: ['Handle & ISO separates speed from control. The workflow focuses on how an athlete enters a move, changes direction, manages center of mass, and exits into the next action.', 'A coach reviews the trace alongside defender context and court position; no single acceleration value should be treated as a complete evaluation.'],
          specs: [['Input', 'Sideline or elevated game-speed video'], ['Model', 'iso-track-v2'], ['Trace', 'Entry, plant, shift, exit'], ['Review', 'Context-aware coach confirmation']],
          steps: ['Mark the attack line and defender relationship.', 'Resolve foot plant, hip drop, and ball-transfer timing.', 'Measure the separation window without discarding video context.', 'Repeat from both directions and compare asymmetry.'],
          primary: ['View handle plays', 'gallery.html?filter=handles']
        },
        {
          id: 'finishing', eyebrow: 'Pipeline 03 / rim-apex-v4', title: 'Rim Finish & Dunk',
          summary: 'Apex, hangtime, reach, and contact-window analysis for finishing above and around the rim.',
          image: IMAGES.finishing, alt: 'Basketball athlete finishing above the rim', caption: 'Rim apex · takeoff-to-contact window',
          stats: [['Vertical', '42.5 in'], ['Hangtime', '0.88s'], ['Contact', '2.4G'], ['Output', 'Apex trace']],
          prose: ['Rim Finish keeps takeoff mechanics, flight window, ball protection, and landing context in one reviewable sequence.', 'Illustrative force and lift values require calibrated capture hardware before they can support training decisions. They are not medical measurements.'],
          specs: [['Input', 'Baseline and sideline video'], ['Model', 'rim-apex-v4'], ['Trace', 'Load, takeoff, apex, contact, landing'], ['Safety', 'Coach and medical roles remain separate']],
          steps: ['Identify the last two approach steps and load position.', 'Resolve takeoff, apex, contact, and landing frames.', 'Compare reach and timing with the selected finish type.', 'Verify the cue without encouraging unsafe load.'],
          primary: ['View finishing plays', 'gallery.html?filter=finishing']
        },
        {
          id: 'vision', eyebrow: 'Pipeline 04 / vision-iq-v3', title: 'Court Vision & IQ',
          summary: 'Spatial review for passing windows, coverage reads, off-ball gravity, and possession context.',
          image: IMAGES.footwork, alt: 'Basketball court movement and spacing frame', caption: 'Vision IQ · possession-space reconstruction',
          stats: [['Court Model', 'Full 3D'], ['Target Interval', '<20ms'], ['Context', 'Possession'], ['Output', 'Decision trace']],
          prose: ['Court Vision treats a decision as a spatial event rather than an isolated highlight. Player position, coverage, ball location, and available passing windows stay synchronized.', 'The interface demonstrates the review pattern. Production latency and identification accuracy must be measured on the final camera and network topology.'],
          specs: [['Input', 'Wide or multi-view court video'], ['Model', 'vision-iq-v3'], ['Trace', 'Position, coverage, window, outcome'], ['Output', 'Reviewable possession timeline']],
          steps: ['Calibrate court coordinates and camera overlap.', 'Resolve player and ball position for the selected possession.', 'Identify available windows and defensive rotations.', 'Compare the chosen action with plausible alternatives.'],
          primary: ['Open full playbook', 'gallery.html']
        }
      ]
    },
    play: {
      page: 'play.html',
      directory: 'plays',
      origin: ['Playbook', 'gallery.html'],
      records: [
        play('apex-flush', 'Apex Tomahawk Flush', 'finishing', 'rim-apex-v4', '42.5 in vertical', '0.88s hangtime', '882194-FLUSH', 'Explosive two-handed finish reviewed from approach load through apex and landing.'),
        play('crossover-burst', 'Streetball Crossover Burst', 'handles', 'iso-track-v2', '18.4 mph entry', '0.12s lateral shift', '440182-SHAMMGOD', 'Low crossover sequence focused on hip depth, ball-transfer timing, and separation.'),
        play('arena-three', 'Arena Catch & Shoot 3PT', 'shooting', 'shot-engine-v3', '45.2° trajectory', '2,400 RPM', '771092-SWISH', 'Catch-to-release sequence with foot replacement, lift, and high-arc entry context.'),
        play('hardwood-brake', 'Hardwood Brake Dynamics', 'footwork', 'traction-lab-v1', '2.8G brake force', '99.4% adherence', '119830-GRIP', 'Hard plant sequence examining traction, lateral braking, and stable re-acceleration.'),
        play('stepback-dagger', 'Step-Back Dagger Isolation', 'handles', 'iso-track-v2', '3.4 ft clearance', '3.2G stop', '339108-STEPBACK', 'Isolation step-back reviewed for deceleration control and balanced shot preparation.'),
        play('baseline-jam', 'Baseline Two-Handed Jam', 'finishing', 'rim-apex-v4', '11.2 ft reach', '1,850 N impact', '559120-JAM', 'Baseline cut and two-handed finish with rotation, contact, and landing context.'),
        play('corner-three', 'Corner Pocket Deep Three', 'shooting', 'shot-engine-v3', '46.1° geometry', '0.64s release', '901248-CORNER', 'Drive-and-kick corner shot focused on foot replacement and compact release timing.'),
        play('defensive-slide', 'Defensive Slide Adherence', 'footwork', 'traction-lab-v1', '0.09s reaction', '1.14 friction index', '661042-SLIDE', 'Point-of-attack slide reviewed for first reaction, plant stability, and recovery line.'),
        play('alley-oop', 'Transition Alley-Oop Apex', 'finishing', 'rim-apex-v4', '41.8 in lift', '0.84s hangtime', '882194-OOP', 'Transition lob finish synchronized around catch height, apex extension, and rim descent.'),
        play('hesitation-freeze', 'In-and-Out Hesitation Freeze', 'handles', 'iso-track-v2', '19.1 mph burst', '0.14s freeze', '440182-HESI', 'Downhill hesitation focused on head-fake timing and the first acceleration window.'),
        play('curl-high-arc', 'Off-Screen Curl High Arc', 'shooting', 'shot-engine-v3', '45.8° trajectory', '2,450 RPM', '771092-CURL', 'Pin-down curl reviewed from hip square through release and landing alignment.'),
        play('sprint-decel', 'Elite Step Deceleration', 'footwork', 'traction-lab-v1', '3.1G brake', '99.7% adherence', '119830-PLANT', 'Full-court sprint stop focused on load distribution and control before re-acceleration.'),
        play('shammgod', 'Shammgod Elite Misdirection', 'handles', 'iso-track-v2', '2.9 ft separation', '0.11s pullback', '440182-SHAMM', 'Cross-body pullback reviewed for bait timing, hand transition, and exit lane.'),
        play('eurostep', 'Wide Eurostep Extension', 'finishing', 'rim-apex-v4', '4.2 ft lateral step', 'soft glass touch', '882194-EURO', 'Two-step finishing sequence focused on direction change, extension, and controlled landing.'),
        play('elbow-pullup', 'Elbow Pull-Up Midrange', 'shooting', 'shot-engine-v3', '44.9° trajectory', '0.62s release', '771092-MID', 'Elbow pull-up reviewed for braking, vertical rise, and stable release alignment.'),
        play('pivot-spin', 'Low Post Pivot Spin Torque', 'footwork', 'traction-lab-v1', '220°/s rotation', '99.9% axis hold', '119830-PIVOT', 'Low-post spin focused on pivot integrity, rotational control, and finish alignment.')
      ]
    },
    plan: {
      page: 'plan.html',
      directory: 'plans',
      origin: ['Reps & tiers', 'pricing.html'],
      records: [
        {
          id: 'starter', eyebrow: 'Plan 01 / individual', title: 'Amateur Hooper', summary: 'A focused entry path for one athlete building a consistent video and coaching routine.', image: IMAGES.shooting, alt: 'Individual player practicing a jump shot', caption: 'Starter workflow · one athlete · standard capture',
          stats: [['Illustrative Price', '$0 / mo'], ['Monthly Reps', '2,000'], ['Capture', '60 FPS'], ['Profiles', '1 athlete']],
          prose: ['Amateur Hooper is designed as the smallest complete workflow: capture a rep, inspect the evidence, save one cue, and compare the next session.', 'Pricing and quotas shown in this demonstration are illustrative and require confirmation in a production agreement.'],
          specs: [['Best for', 'Individual development'], ['Includes', 'Arc and release summary'], ['Export', 'Personal session record'], ['Support', 'Self-directed workflow']],
          steps: ['Record a representative baseline session.', 'Choose one measurable movement target.', 'Repeat under consistent camera placement.', 'Review progress before increasing volume.'], primary: ['Start a conversation', 'contact.html?plan=starter']
        },
        {
          id: 'studio', eyebrow: 'Plan 02 / team studio', title: 'Collegiate Pro', summary: 'A shared coaching workspace for structured rosters, multiple pipelines, and calibrated court video.', image: IMAGES.handles, alt: 'Team basketball performance drill', caption: 'Team workflow · roster review · multi-pipeline',
          stats: [['Illustrative Price', '$49 / mo'], ['Monthly Reps', '15,000'], ['Capture', 'Up to 240 FPS'], ['Profiles', 'Up to 20']],
          prose: ['Collegiate Pro expands the evidence loop across a roster while keeping athlete records, coaching cues, and source frames separated by role.', 'Compatibility, staffing, response time, and institutional data controls must be verified during deployment discovery.'],
          specs: [['Best for', 'Schools, clubs, and AAU programs'], ['Includes', 'Four analysis pipelines'], ['Input', 'Mobile and calibrated court feeds'], ['Governance', 'Role and retention plan required']],
          steps: ['Document roster, court, and coaching objectives.', 'Validate camera compatibility and calibration.', 'Define staff roles and athlete consent workflow.', 'Pilot one drill before expanding team-wide.'], primary: ['Discuss team deployment', 'contact.html?plan=studio']
        },
        {
          id: 'scale', eyebrow: 'Plan 03 / franchise scale', title: 'Franchise Apex', summary: 'A high-throughput integration brief for multi-court programs, custom feeds, and scouting operations.', image: IMAGES.finishing, alt: 'Professional arena basketball action', caption: 'Scale workflow · multi-court · integration review',
          stats: [['Illustrative Price', '$189 / mo'], ['Monthly Reps', '60,000'], ['Capture', 'Up to 480 FPS'], ['Profiles', 'Custom scope']],
          prose: ['Franchise Apex frames the requirements for volume ingestion, multiple facilities, data export, and specialist review.', 'API scope, accuracy, service levels, security ownership, and league-format claims remain subject to a signed production specification.'],
          specs: [['Best for', 'Franchises, labs, and combines'], ['Integration', 'Scoped API and event feeds'], ['Operations', 'Multi-court review'], ['Assurance', 'Deployment-specific validation']],
          steps: ['Map facilities, feeds, users, and data boundaries.', 'Prototype one representative court integration.', 'Load-test the expected capture and review volume.', 'Approve security, retention, support, and rollback plans.'], primary: ['Request scale discovery', 'contact.html?plan=scale']
        }
      ]
    },
    principle: {
      page: 'principle.html',
      directory: 'principles',
      origin: ['Manifesto', 'about.html'],
      records: [
        { id: 'fidelity', eyebrow: 'Principle 01 / optical fidelity', title: 'Calibrated Evidence', summary: 'Measurements should retain their source frame, calibration state, and known uncertainty.', image: IMAGES.footwork, alt: 'Basketball shoes aligned to hardwood court markings', caption: 'Optical fidelity · calibration before interpretation', stats: [['Priority', 'Traceability'], ['Input', 'Court video'], ['Tolerance', 'Validated locally'], ['Claim', 'Evidence-led']], prose: ['CourtSpec treats calibration as part of the result, not a hidden setup step. A number without its capture conditions is incomplete.', 'Production teams should document lens profile, camera position, frame rate, reference geometry, and acceptance tolerance.'], specs: [['Design rule', 'Show the evidence chain'], ['Operational rule', 'Recalibrate when conditions change'], ['Quality rule', 'Report uncertainty'], ['Governance rule', 'Do not overstate accuracy']], steps: ['Define the intended coaching decision.', 'Select a capture setup appropriate to that decision.', 'Validate against known reference geometry.', 'Retain calibration metadata with the trace.'], primary: ['Explore pipeline details', 'details/pipelines/shooting.html'] },
        { id: 'provenance', eyebrow: 'Principle 02 / shot provenance', title: 'Repeatable Mechanics', summary: 'Coaching hypotheses become useful when the same drill can be measured and reviewed again.', image: IMAGES.shooting, alt: 'Basketball shot captured through its release path', caption: 'Provenance · cue, rep, comparison', stats: [['Priority', 'Repeatability'], ['Unit', 'One drill'], ['Review', 'Frame linked'], ['Outcome', 'Comparable']], prose: ['A score is less useful than a trace that explains what changed. The interface keeps the source moment beside the coaching interpretation.', 'Repeatability also means preserving the drill, angle, calibration, and athlete context used for comparison.'], specs: [['Design rule', 'Keep source and output together'], ['Coaching rule', 'Change one variable at a time'], ['Review rule', 'Compare like with like'], ['Data rule', 'Preserve revision history']], steps: ['Choose a stable baseline rep.', 'Record one explicit coaching hypothesis.', 'Repeat with the same capture conditions.', 'Accept or revise the cue based on evidence.'], primary: ['Open the playbook', 'gallery.html'] },
        { id: 'native', eyebrow: 'Principle 03 / native web', title: 'Zero-Bloat Delivery', summary: 'A small native surface improves portability, auditability, and courtside resilience.', image: IMAGES.handles, alt: 'Basketball player training on an outdoor court', caption: 'Native web · direct browser delivery', stats: [['Dependencies', '0 runtime'], ['Layout', 'Mobile first'], ['Delivery', 'Static capable'], ['Mode', 'Offline shell']], prose: ['The interface uses semantic HTML, layered CSS, and browser-native JavaScript. It can be served from a basic static host and remains usable without a framework runtime.', 'Zero dependency does not mean zero responsibility: browser support, security headers, accessibility, and content validation still require deployment testing.'], specs: [['HTML', 'Semantic landmarks and controls'], ['CSS', 'Layered mobile-first architecture'], ['JavaScript', 'File-safe progressive enhancement'], ['PWA', 'Scoped service-worker shell']], steps: ['Start from semantic content and working links.', 'Add responsive layout from 320px upward.', 'Enhance only where interaction adds value.', 'Verify failure states and cache updates.'], primary: ['Review deployment brief', 'details/briefs/readiness.html'] },
        { id: 'integrity', eyebrow: 'Principle 04 / scouting integrity', title: 'Consent-Led Review', summary: 'Performance data should support people without hiding ownership, context, or decision responsibility.', image: IMAGES.finishing, alt: 'Basketball athlete reviewed in a performance context', caption: 'Integrity · athlete context · accountable use', stats: [['Priority', 'Consent'], ['Ownership', 'Documented'], ['Access', 'Least privilege'], ['Review', 'Human accountable']], prose: ['Telemetry can amplify bias when context and governance are ignored. A responsible workflow documents why data is collected, who can see it, and how an athlete can correct or remove it.', 'This static demonstration stores no athlete records. Production use requires policy, technical controls, and accountable human review.'], specs: [['Privacy', 'Purpose and retention defined'], ['Access', 'Role-based and auditable'], ['Athlete rights', 'Export, correction, deletion'], ['Decisions', 'Human review retained']], steps: ['Document purpose before collection.', 'Capture informed consent and access roles.', 'Review output with relevant sporting context.', 'Support correction, export, and deletion requests.'], primary: ['Read data governance', 'about.html#data-governance'] }
      ]
    },
    brief: {
      page: 'brief.html',
      directory: 'briefs',
      origin: ['Scout contact', 'contact.html'],
      records: [
        { id: 'readiness', eyebrow: 'Brief 01 / discovery', title: 'Deployment Readiness', summary: 'A practical discovery sequence for court conditions, goals, users, data, and operational ownership.', image: IMAGES.footwork, alt: 'Basketball court prepared for a technical review', caption: 'Discovery brief · scope before commitment', stats: [['Stage', 'Discovery'], ['Input', 'Court + workflow'], ['Output', 'Scoped pilot'], ['Decision', 'Go / revise']], prose: ['A high-quality deployment begins with the coaching decision, not the camera specification. The discovery brief maps the court, drill, users, and evidence expected.', 'This page describes a planning workflow only. Availability, pricing, accuracy, and service levels require confirmation.'], specs: [['Facility', 'Court geometry, lighting, network'], ['People', 'Athletes, coaches, operators, reviewers'], ['Data', 'Purpose, access, retention, deletion'], ['Operations', 'Support, incident response, rollback']], steps: ['Describe the coaching or scouting decision.', 'Inventory current cameras, court conditions, and workflows.', 'Select one representative pilot drill.', 'Define acceptance evidence before implementation.'], primary: ['Open contact form', 'contact.html?topic=general'] },
        { id: 'calibration', eyebrow: 'Brief 02 / camera', title: 'Court Calibration', summary: 'A capture-readiness checklist for camera position, reference geometry, lighting, and repeatability.', image: IMAGES.shooting, alt: 'Basketball court video capture reference', caption: 'Calibration brief · geometry, light, validation', stats: [['Stage', 'Technical review'], ['Reference', 'Court geometry'], ['Evidence', 'Test sequence'], ['Output', 'Calibration record']], prose: ['Calibration determines whether a visual measurement can be interpreted consistently. Camera movement, zoom, lighting, and occlusion must be included in the test plan.', 'The goal is a documented operating envelope, not an unsupported universal accuracy claim.'], specs: [['Camera', 'Resolution, frame rate, lens, position'], ['Scene', 'Lighting, lines, rim, occlusion'], ['Validation', 'Known reference sequence'], ['Maintenance', 'Recheck triggers and ownership']], steps: ['Capture the empty court and reference geometry.', 'Record representative drills at normal speed.', 'Compare outputs with known measurements.', 'Document when recalibration is required.'], primary: ['Discuss camera setup', 'contact.html?topic=camera'] },
        { id: 'governance', eyebrow: 'Brief 03 / data', title: 'Data Governance', summary: 'A production checklist for consent, access, retention, security, and accountable athlete-data use.', image: IMAGES.handles, alt: 'Basketball team workflow and data review', caption: 'Governance brief · purpose, control, accountability', stats: [['Stage', 'Assurance'], ['Priority', 'Athlete rights'], ['Access', 'Least privilege'], ['Output', 'Control matrix']], prose: ['A telemetry workflow should collect only what is required for the defined coaching or scouting purpose. Ownership and responsibilities must be visible before data arrives.', 'Security headers and encryption are only part of the control set; staffing, review, recovery, deletion, and incident handling matter equally.'], specs: [['Consent', 'Purpose-specific and recorded'], ['Retention', 'Time-bound with deletion workflow'], ['Security', 'Encryption, least privilege, monitoring'], ['Accessibility', 'Final content formally tested']], steps: ['Classify each data field and its purpose.', 'Assign owner, access roles, and retention window.', 'Test export, correction, deletion, and recovery.', 'Review controls whenever scope or vendors change.'], primary: ['Discuss governance', 'contact.html?topic=general'] },
        { id: 'integration', eyebrow: 'Brief 04 / API', title: 'Integration Scope', summary: 'A boundary-first approach to feeds, events, authentication, failure handling, and data ownership.', image: IMAGES.finishing, alt: 'Basketball telemetry integration workflow', caption: 'Integration brief · contract before connection', stats: [['Stage', 'Architecture'], ['Interface', 'Scoped API'], ['Failure', 'Recoverable'], ['Output', 'Tested contract']], prose: ['Integrations should begin from the minimum data contract required by the downstream workflow. Authentication, idempotency, retry behavior, and ownership are part of that contract.', 'The static demonstration exposes no public API. Production endpoints and league-format exports require a separately reviewed specification.'], specs: [['Contract', 'Fields, events, versioning'], ['Security', 'Authentication and least privilege'], ['Reliability', 'Timeout, retry, idempotency'], ['Operations', 'Monitoring, support, rollback']], steps: ['Map producer, consumer, and required data fields.', 'Define authentication and error contracts.', 'Test partial failure, retries, and duplicate events.', 'Approve monitoring, rollback, and ownership.'], primary: ['Discuss API integration', 'contact.html?topic=api'] },
        { id: 'privacy', eyebrow: 'Assurance 01 / privacy', title: 'Athlete Data Privacy', summary: 'Purpose limitation, consent, retention, correction, and deletion controls for athlete performance data.', image: IMAGES.finishing, alt: 'Basketball athlete in a controlled performance review', caption: 'Privacy brief · purpose before collection', stats: [['Priority', 'Data minimization'], ['Consent', 'Purpose specific'], ['Retention', 'Time bound'], ['Rights', 'Correction + deletion']], prose: ['Athlete telemetry should be collected only for a documented coaching or scouting purpose. Each field needs an owner, retention window, and defensible reason to exist.', 'Production deployments should provide clear consent, access, correction, export, and deletion workflows without making participation rights difficult to exercise.'], specs: [['Collection', 'Minimum data required'], ['Consent', 'Recorded and revocable'], ['Retention', 'Documented deletion schedule'], ['Disclosure', 'Named roles and recipients']], steps: ['Define the purpose and minimum fields.', 'Record consent and access roles.', 'Test correction, export, and deletion.', 'Review the policy when scope changes.'], primary: ['Discuss privacy controls', 'contact.html?topic=general'] },
        { id: 'accessibility', eyebrow: 'Assurance 02 / accessibility', title: 'Accessible Court Interface', summary: 'Keyboard, focus, contrast, motion, semantics, and assistive-technology requirements for the complete experience.', image: IMAGES.shooting, alt: 'Basketball shooting interface prepared for accessible review', caption: 'Accessibility brief · equivalent access by design', stats: [['Target', 'WCAG 2.2 AA'], ['Input', 'Keyboard ready'], ['Motion', 'User controlled'], ['Review', 'Human tested']], prose: ['Accessibility is part of the interaction contract, not a final visual pass. Navigation, filters, sliders, forms, and detail pages must remain understandable without a pointer.', 'Automated checks help, but final conformance requires representative keyboard, screen-reader, zoom, contrast, and reduced-motion testing.'], specs: [['Semantics', 'Landmarks and native controls'], ['Focus', 'Visible and predictable'], ['Visual', 'Contrast and 200% zoom'], ['Motion', 'Reduced-motion alternative']], steps: ['Verify the semantic reading order.', 'Complete every flow with a keyboard.', 'Test zoom, contrast, and reduced motion.', 'Resolve findings with user impact first.'], primary: ['Review native-web principle', 'details/principles/native.html'] },
        { id: 'security', eyebrow: 'Assurance 03 / security', title: 'Secure Native Delivery', summary: 'A deployment checklist for headers, dependency minimization, input handling, isolation, and recovery.', image: IMAGES.handles, alt: 'Outdoor basketball court representing resilient native delivery', caption: 'Security brief · small surface, explicit controls', stats: [['Runtime deps', '0'], ['Input', 'Validated'], ['Headers', 'Deployment set'], ['Recovery', 'Tested']], prose: ['A zero-dependency interface reduces supply-chain surface but does not replace deployment controls. Content security, transport, framing, referrer, and caching policies still require explicit configuration.', 'User-controlled values should never become executable markup, and operational recovery should be tested before the site is treated as production ready.'], specs: [['Client code', 'No unsafe HTML injection'], ['Transport', 'HTTPS and HSTS'], ['Browser', 'CSP and framing policy'], ['Operations', 'Versioned cache and rollback']], steps: ['Inventory every executable asset.', 'Apply restrictive deployment headers.', 'Test invalid input and offline updates.', 'Document rollback and incident ownership.'], primary: ['Discuss security review', 'contact.html?topic=api'] },
        { id: 'terms', eyebrow: 'Assurance 04 / terms', title: 'Responsible Use Terms', summary: 'Clear product boundaries for illustrative metrics, coaching judgment, availability, and production commitments.', image: IMAGES.footwork, alt: 'Basketball court markings defining responsible product boundaries', caption: 'Terms brief · claims matched to evidence', stats: [['Metrics', 'Illustrative'], ['Decision', 'Human accountable'], ['Availability', 'Confirmed separately'], ['Claims', 'Evidence bounded']], prose: ['Demonstration metrics describe interface behavior and should not be treated as medical, eligibility, contractual, or guaranteed performance conclusions.', 'Production terms should identify service scope, support ownership, acceptable use, data responsibilities, and the evidence supporting any accuracy or availability claim.'], specs: [['Telemetry', 'Context required'], ['Coaching', 'Human judgment retained'], ['Commercial', 'Signed scope governs'], ['Claims', 'No unsupported guarantees']], steps: ['Separate demonstration from contracted behavior.', 'Document decision responsibility.', 'Confirm service and data boundaries.', 'Review claims against current evidence.'], primary: ['Start a scoped conversation', 'contact.html?topic=general'] }
      ]
    }
  };

  return catalog;
}

const COURTSPEC_DETAIL_CATALOG = createDetailCatalog();
if (typeof globalThis !== 'undefined') {
  globalThis.COURTSPEC_DETAIL_CATALOG = COURTSPEC_DETAIL_CATALOG;
}

function initDetailPage() {
  const root = document.querySelector('[data-detail-root]');
  const kind = document.body.dataset.detailKind;
  if (!root || !kind) return;

  const catalog = COURTSPEC_DETAIL_CATALOG;

  const config = catalog[kind];
  if (!config) return;

  const requestedId = document.body.dataset.detailId || new URLSearchParams(window.location.search).get('id');
  const index = Math.max(0, config.records.findIndex((item) => item.id === requestedId));
  const record = config.records[index] || config.records[0];
  const previous = config.records[(index - 1 + config.records.length) % config.records.length];
  const next = config.records[(index + 1) % config.records.length];
  const usesStaticRoutes = document.body.dataset.detailRouteMode === 'static';
  const detailHref = (item) => usesStaticRoutes
    ? `details/${config.directory}/${encodeURIComponent(item.id)}.html`
    : `${config.page}?id=${encodeURIComponent(item.id)}`;

  function setText(selector, value) {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  }

  function renderPairs(selector, entries, itemClass) {
    const container = root.querySelector(selector);
    if (!container) return;
    const fragment = document.createDocumentFragment();
    entries.forEach(([label, value]) => {
      const wrapper = document.createElement('div');
      if (itemClass) wrapper.className = itemClass;
      const term = document.createElement(selector === '[data-detail-specs]' ? 'dt' : 'span');
      const description = document.createElement(selector === '[data-detail-specs]' ? 'dd' : 'strong');
      term.textContent = label;
      description.textContent = value;
      wrapper.append(term, description);
      fragment.appendChild(wrapper);
    });
    container.replaceChildren(fragment);
  }

  function renderTextList(selector, entries, tagName) {
    const container = root.querySelector(selector);
    if (!container) return;
    const fragment = document.createDocumentFragment();
    entries.forEach((text) => {
      const item = document.createElement(tagName);
      item.textContent = text;
      fragment.appendChild(item);
    });
    container.replaceChildren(fragment);
  }

  setText('[data-detail-eyebrow]', record.eyebrow);
  setText('[data-detail-title]', record.title);
  setText('[data-detail-summary]', record.summary);
  setText('[data-detail-caption]', record.caption);
  setText('[data-detail-current]', record.title);
  setText('[data-detail-origin-label]', config.origin[0]);

  const image = root.querySelector('[data-detail-image]');
  if (image) {
    image.src = record.image.replace('assets/images/', 'assets/images/optimized/').replace('.jpg', '.webp');
    image.alt = record.alt;
  }

  const originLinks = root.querySelectorAll('[data-detail-origin]');
  originLinks.forEach((link) => { link.href = config.origin[1]; });

  const primary = root.querySelector('[data-detail-primary]');
  if (primary) {
    primary.textContent = record.primary[0];
    primary.href = record.primary[1];
  }

  renderPairs('[data-detail-stats]', record.stats, 'vy-detail-stat');
  renderPairs('[data-detail-specs]', record.specs);
  renderTextList('[data-detail-prose]', record.prose, 'p');
  renderTextList('[data-detail-steps]', record.steps, 'li');

  const prevLink = root.querySelector('[data-detail-prev]');
  const nextLink = root.querySelector('[data-detail-next]');
  if (prevLink) {
    prevLink.href = detailHref(previous);
    const label = prevLink.querySelector('strong');
    if (label) label.textContent = previous.title;
  }
  if (nextLink) {
    nextLink.href = detailHref(next);
    const label = nextLink.querySelector('strong');
    if (label) label.textContent = next.title;
  }

  document.title = `${record.title} — COURTSPEC`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = record.summary;
  const canonical = document.querySelector('link[rel="canonical"]');
  const canonicalUrl = document.body.dataset.detailCanonical || `https://courtspec.io/${config.page}?id=${encodeURIComponent(record.id)}`;
  if (canonical) canonical.href = canonicalUrl;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDescription = document.querySelector('meta[property="og:description"]');
  const ogUrl = document.querySelector('meta[property="og:url"]');
  const ogImage = document.querySelector('meta[property="og:image"]');
  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  const twitterDescription = document.querySelector('meta[name="twitter:description"]');
  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  const socialImageUrl = `https://courtspec.io/${record.image}`;
  if (ogTitle) ogTitle.content = `${record.title} — COURTSPEC`;
  if (ogDescription) ogDescription.content = record.summary;
  if (ogUrl) ogUrl.content = canonicalUrl;
  if (ogImage) ogImage.content = socialImageUrl;
  if (twitterTitle) twitterTitle.content = `${record.title} — COURTSPEC`;
  if (twitterDescription) twitterDescription.content = record.summary;
  if (twitterImage) twitterImage.content = socialImageUrl;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDetailPage, { once: true });
  } else {
    initDetailPage();
  }
}
