export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  department: string;
  url: string;
  postedAt: Date;
  source: string;
  employmentType?: string;
  salary?: string;
  locations?: string[];
  region?: string;
  isEarlyCareer?: boolean;
  slug?: string;
  experienceLevel?: string;
}
