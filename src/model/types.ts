export type Vec3 = [number, number, number];
export type ScenarioId = 'known' | 'shifted' | 'missing';
export type ControllerId = 'nominal' | 'estimate' | 'belief' | 'oracle';
export type ViewId = 'side' | 'overhead';
export type Tilt = 0 | 5 | 10;
export interface FixtureSpec {version:1; tilt:Tilt; indexed:boolean; window:number; seatingSigma:number; clearance:number;}
export interface ScenarioSpec {version:1; id:ScenarioId; seed:number; volume:number; fixture:FixtureSpec; historyKnown:boolean; contrast:number; poseSigma:number; pumpSigma:number; cameraBias:number;}
/** Never given to an observed controller. Only environment, renderer, and scorer consume truth. */
export interface WorldState {volume:number; initialVolume:number; pose:Vec3; tilt:Tilt; pelletAngle:number; pelletZ:number; pelletRadius:number; contrast:number; fixture:FixtureSpec;}
export interface Calibration {view:ViewId; width:number;height:number; mmPerPixel:number; center:Vec3; origin:Vec3; direction:Vec3; right:Vec3; up:Vec3;}
export interface ObservationPacket {version:1; id:string; t:number; calibration:Calibration; pixels:Uint8ClampedArray; valid:Uint8Array; exposureGroup:string;}
export interface Features {level:number|null; levelSigma:number; tubeX:number|null; tubeXSigma:number; pelletAngle:number|null; pelletSigma:number; visiblePixels:number; quality:number;}
export interface Particle {volume:number; pose:Vec3; pelletAngle:number; weight:number;}
export interface BeliefState {version:1; particles:Particle[]; seenGroups:string[]; observations:number; volume:[number,number]; poseX:[number,number]; pelletKnown:boolean; effectiveN:number;}
export interface PolicySpec {version:1; controller:ControllerId; chunk:number; margin:number; surfaceDepth:number; observeEvery:number; residualTarget:number;}
export type Action = {kind:'move';to:Vec3}|{kind:'aspirate';volume:number;rate:number}|{kind:'observe';view:ViewId}|{kind:'stop';reason:string};
export interface TraceEvent {index:number;t:number;duration:number;action:Action;tip:Vec3;volume:number;aspirated:number;belief:{volume:[number,number];poseX:[number,number];pelletKnown:boolean;effectiveN:number};reason:string;clearance:number;violations:string[];observation?:{view:ViewId;features:Features;packetId:string};}
export interface RunTrace {version:1;modelVersion:string;id:string;scenario:ScenarioSpec;policy:PolicySpec;initial:WorldState;events:TraceEvent[];result:{remaining:number;removed:number;seconds:number;violations:string[];status:'completed'|'stopped'|'violated';reason:string;minClearance:number;observations:number};provenance:{kind:'live'|'recorded';source:string;seed:number;referenceStatus:string;};}
export interface PolicySummary {controller:ControllerId;n:number;meanRemaining:number;meanSeconds:number;violationRate:number;violationCI:[number,number];completed:number;stopped:number;meanObservations:number;}
export interface ExperimentReport {version:1;modelVersion:string;generatedAt:string;split:string;seeds:number[];summaries:PolicySummary[];stress:{n:number;rejected:number};notes:string[];}
export interface SurfaceEnvelope {version:1;status:'pending'|'verified';source:string;maxErrorMm:number;cases:{tilt:Tilt;volume:number;contactAngle:number;minZ:number;maxZ:number;volumeError:number;mesh:number}[];}
