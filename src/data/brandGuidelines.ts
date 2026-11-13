// Range concepts from the BioMar Product Brand Guidelines 2025 (v1).
// Shown in each product's Internal information as the range's positioning.
// Ranges marked "Coming soon" in the guidelines have no description yet.

export const GUIDELINES = 'BioMar Product Brand Guidelines 2025'

export interface RangeConcept {
  tagline?: string
  description?: string
  attributes?: string
  positioning?: string
  differentiation?: string
  conceptPositioning?: string
  page: number
}

export const RANGE_CONCEPTS: Record<string, RangeConcept> = {
  LARVIVA: {
    tagline: 'Start Strong. Stay Strong.',
    description: 'LARVIVA offers a complete range of hatchery feeds tailored for fish and shrimp. It is specially developed to maximise the success of the hatchery operations. Designed to give larvae a strong Start and ensure Robust, high-quality fry and post larvae, well-prepared for the grow-out stage.',
    page: 12,
  },
  INICIO: { page: 38 },
  INTRO: {
    description: 'INTRO is a holistic nutritional strategy preparing and supporting fish through the challenging transfer period delivering Robustness and high Performance.',
    page: 66,
  },
  EXIA: {
    tagline: 'Optimise your Performance',
    description: 'EXIA is the result of extensive research and decades of experience formulating high Performance shrimp feeds. Our shrimp feeds are crafted to deliver optimal nutrition, ensuring your shrimp thrive.\n\nWe offer you a complete selection of top-quality feeds and intelligent nutritional solutions, empowering you to achieve the best economic results tailored to your unique Environment and farming conditions.',
    page: 78,
  },
  EFICO: { tagline: 'Optimise your Performance', page: 94 },
  MAXIO: { tagline: 'Optimise your Performance', page: 118 },
  POWER: { tagline: 'Optimise your Performance', page: 126 },
  SmartCare: {
    tagline: 'You Care. We Care. SmartCare.',
    description: 'BioMar introduces SmartCare a preventative healthcare program that helps tackle the daily challenges faced in the operations of aquaculture. By adjusting nutritional and functional ingredients you can reduce the risk of health challenges while supporting growth.\n\nThe SmartCare range enables you to ward off the unwanted when and only when it is needed. Together with BioMar health and technical specialists you can create a specialised healthcare program that fits your individual needs.\n\nBeing proactive with SmartCare not only helps maintain good health to ensure optimal Performance but you can rest assured you are delivering the very best in aquaculture care and welfare.',
    attributes: 'Protective, proactive, nurturing',
    positioning: 'Protective. Champion Brand.',
    differentiation: 'New space in aquaculture farming and feed and tapping into the major trends of reduced medication and animal welfare.',
    conceptPositioning: 'SmartCare, a preventative healthcare program that helps tackle the daily challenges faced in the operations of aquaculture. By adjusting nutritional and functional ingredients you can reduce the risk of health challenges while supporting growth.',
    page: 142,
  },
  'Blue Impact': {
    tagline: 'Progressively transforming aquaculture',
    description: 'Our Blue Impact feed range acts as a catalyst for driving change as we use applied, science-based sustainability to select ingredients that have a lower impact on our planet.',
    page: 194,
  },
  ORBIT: {
    description: 'ORBIT is a specialised aquafeed range, meticulously crafted to suit advanced aquaculture technology like Recirculating Aquaculture Systems (RAS). It is the perfect choice when you are in an intensive farming Environment or looking to enhance waste reduction and faeces stability.\n\nWith ORBIT, you can count on maximising not only your fish’s Performance but also the efficiency of your RAS system & biofilters.',
    page: 202,
  },
  Symbio: {
    description: 'Cleaner fish are a highly valued partner of fish farmers as they gently and continually de-louses salmon. Careful management of a complete nutritional diet is critical for the Balance and wellbeing of this cherished fish, ensuring it can Perform at its very best.\n\nBioMar’s Symbio range prioritises fundamentally strong, species-specific nutrition. Covering the feeding needs of all relevant cleaner fish species, both in onshore production and as Lice-eaters in the sea.',
    page: 214,
  },
  'DAN-EX': {
    description: 'Based on many years of experience and development and with the widest range of sizes for all eel stages, DAN-EX aims to deliver the lowest feed quotient, highest growth rate and maximum production per m³ to minimize the total costs per kg of eel produced and maximize farm production.',
    page: 226,
  },
  'TRI-X': {
    description: 'Specifically formulated for the rapid growth and unique needs of triploid salmon, the Tri-X feed range ensures optimal development from freshwater to harvest. Backed by years of research, Tri-X delivers the precise nutrition, particularly Vital minerals, required for strong skeletal development, helping to minimize deformities and cataracts often associated with triploid farming.',
    page: 230,
  },
}
