import { Warehouse, Rabbit, BookOpen, HeartPulse, CookingPot, Building2, Boxes, Car, FileCode, Headphones, Globe, WandSparkles, Paintbrush, Ellipsis, BriefcaseBusiness } from 'lucide-react';

/**
 * The section and category lists behind the news desk and the jobs board.
 *
 * <p>Kept out of the page components because three surfaces need them: the page's own
 * filter bar, its composer, and the dashboard's publishing panel. Exporting them from
 * News.jsx and Jobs.jsx made those pages export non-components, which breaks Fast Refresh
 * for the whole file — a shared constant belongs in a module of its own.
 *
 * <p>The ids are written onto articles and adverts and are what the filters query, so they
 * are effectively permanent once content carries them. The display names are free to change.
 * The backend ingest mappers (NewsCategoryMapper, AdzunaCategoryMapper) classify imported
 * content into these same ids, so fetched and natively posted items share one filter bar —
 * change an id here and the matching entry there has to move with it.
 */

/**
 * News sections.
 *
 * The ids are stored on the article and used as the filter, so they must not change once
 * articles carry them — the display names are free to.
 *
 * Ordered by who is actually reading this. HustleSpace's audience is students and young
 * workers in Lublin, a large share of them international, so "what is happening in this
 * city" and "what does this mean for someone here on a visa" lead; the generic business
 * and tech sections that used to be the whole list sit at the end.
 *
 * Shared with the ingest side: `NewsCategoryMapper` on the backend classifies imported
 * articles into these same ids, so a story pulled from a Lublin outlet lands under Lublin
 * rather than in an "uncategorised" bucket the filter bar cannot reach.
 */
export const SECTIONS = [
  { id: 'lublin', name: 'Lublin' },
  { id: 'students', name: 'Student life' },
  { id: 'immigration', name: 'Visas & residence' },
  { id: 'housing', name: 'Housing' },
  { id: 'poland', name: 'Poland' },
  { id: 'opportunity', name: 'Opportunities' },
  { id: 'event', name: 'Events' },
  { id: 'regulation', name: 'Regulation' },
  { id: 'business', name: 'Business' },
  { id: 'tech', name: 'Tech' },
];

/**
 * Job categories.
 *
 * The ids are stored on the advert and drive the filter, so they are stable; names are not.
 *
 * Widened well past the original four (factory / childcare / teaching / nursing), which
 * between them covered almost nothing a student in Poland actually gets hired for — a
 * warehouse picker, a barista, a delivery rider and a Ukrainian-speaking call centre agent
 * all had to be filed under "Industrial & Factory" or left uncategorised.
 *
 * `AdzunaCategoryMapper` on the backend maps imported adverts onto these same ids, so
 * fetched jobs and posted jobs share one filter bar.
 */
export const JOB_CATEGORIES = [
  { id: 'hospitality', name: 'Hospitality & Food', icon: CookingPot },
  { id: 'retail', name: 'Retail & Sales', icon: Building2 },
  { id: 'warehouse', name: 'Warehouse & Logistics', icon: Boxes },
  { id: 'factory', name: 'Industrial & Factory', icon: Warehouse },
  { id: 'delivery', name: 'Delivery & Driving', icon: Car },
  { id: 'it', name: 'IT & Development', icon: FileCode },
  { id: 'office', name: 'Office & Admin', icon: BriefcaseBusiness },
  { id: 'support', name: 'Customer Support', icon: Headphones },
  { id: 'language', name: 'Languages & Translation', icon: Globe },
  { id: 'teaching', name: 'Education & Tutoring', icon: BookOpen },
  { id: 'babysitting', name: 'Family & Childcare', icon: Rabbit },
  { id: 'cleaning', name: 'Cleaning & Facilities', icon: WandSparkles },
  { id: 'healthcare', name: 'Healthcare & Nursing', icon: HeartPulse },
  { id: 'creative', name: 'Creative & Media', icon: Paintbrush },
  { id: 'other', name: 'Everything else', icon: Ellipsis },
];
