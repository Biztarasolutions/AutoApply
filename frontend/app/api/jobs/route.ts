import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q         = (searchParams.get('q') || '').toLowerCase();
  const location  = (searchParams.get('location') || '').toLowerCase();
  const jobType   = searchParams.get('jobType') || '';   // remote | hybrid | onsite
  const minSalary = parseInt(searchParams.get('minSalary') || '0', 10);
  const expLevel  = searchParams.get('expLevel') || '';  // entry | mid | senior | lead
  const source    = searchParams.get('source') || '';

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return NextResponse.json(filterJobs(getMockJobs(), { q, location, jobType, minSalary, expLevel, source }));
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const res = await client.query('SELECT * FROM public.jobs ORDER BY created_at DESC LIMIT 200');
    const jobs = res.rows.length ? res.rows : getMockJobs();
    return NextResponse.json(filterJobs(jobs, { q, location, jobType, minSalary, expLevel, source }));
  } catch {
    return NextResponse.json(filterJobs(getMockJobs(), { q, location, jobType, minSalary, expLevel, source }));
  } finally {
    await client.end().catch(() => {});
  }
}

function parseSalaryMin(salaryRange: string): number {
  if (!salaryRange) return 0;
  const match = salaryRange.replace(/[,$]/g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function filterJobs(jobs: any[], filters: {
  q: string; location: string; jobType: string; minSalary: number; expLevel: string; source: string;
}) {
  return jobs.filter(j => {
    if (filters.q) {
      const haystack = `${j.title} ${j.company} ${j.description} ${(j.requirements || []).join(' ')}`.toLowerCase();
      if (!haystack.includes(filters.q)) return false;
    }
    if (filters.location) {
      if (!j.location.toLowerCase().includes(filters.location)) return false;
    }
    if (filters.jobType) {
      const loc = j.location.toLowerCase();
      if (filters.jobType === 'remote'  && !loc.includes('remote')) return false;
      if (filters.jobType === 'hybrid'  && !loc.includes('hybrid')) return false;
      if (filters.jobType === 'onsite'  && (loc.includes('remote') || loc.includes('hybrid'))) return false;
    }
    if (filters.minSalary > 0) {
      const sal = parseSalaryMin(j.salary_range);
      if (sal > 0 && sal < filters.minSalary) return false;
    }
    if (filters.expLevel) {
      const t = j.title.toLowerCase();
      if (filters.expLevel === 'entry'  && !/junior|entry|associate|graduate|intern/.test(t)) return false;
      if (filters.expLevel === 'mid'    && !/mid|ii|2\+|3\+|engineer(?! lead)/.test(t) && !/mid/.test(t)) return false;
      if (filters.expLevel === 'senior' && !/senior|sr\.?|iii|staff/.test(t)) return false;
      if (filters.expLevel === 'lead'   && !/lead|principal|head|director/.test(t)) return false;
    }
    if (filters.source) {
      if (!j.source?.toLowerCase().includes(filters.source.toLowerCase())) return false;
    }
    return true;
  });
}

function getMockJobs() {
  return [
    {
      id: 'j1',
      title: 'Senior Business Analyst',
      company: 'McKinsey & Company',
      location: 'Bangalore, India (Hybrid)',
      description: 'Drive data-driven strategic decisions for Fortune 500 clients. Partner with cross-functional teams to design analytics frameworks, build dashboards, and deliver insights that influence C-suite decisions. Strong SQL and visualization skills required.',
      requirements: ['5+ years Business Analysis or Analytics', 'Proficiency in SQL, Power BI or Tableau', 'Experience with stakeholder management', 'MBA or equivalent preferred'],
      url: 'https://mckinsey.com/careers',
      source: 'LinkedIn',
      salary_range: '₹35,00,000 – ₹50,00,000',
      tags: ['Analytics', 'Strategy', 'Hybrid'],
    },
    {
      id: 'j2',
      title: 'Data Analyst – Product Analytics',
      company: 'Meesho',
      location: 'Bangalore, India (Remote)',
      description: 'Own the product analytics function for one of India\'s fastest growing e-commerce platforms. Build funnel dashboards, run A/B test analysis, and work directly with PMs to define north-star metrics.',
      requirements: ['3+ years in product or data analytics', 'Expert in SQL and Python (pandas)', 'Experience with A/B testing and experimentation', 'Looker, Metabase, or similar BI tools'],
      url: 'https://meesho.io/careers',
      source: 'Naukri',
      salary_range: '₹18,00,000 – ₹28,00,000',
      tags: ['Product Analytics', 'Remote', 'E-commerce'],
    },
    {
      id: 'j3',
      title: 'Lead Data Scientist',
      company: 'Flipkart',
      location: 'Bangalore, India (Hybrid)',
      description: 'Lead a team of data scientists to build ML models for demand forecasting, price optimization, and recommendation systems. Own model deployment pipelines and collaborate with engineering on production infra.',
      requirements: ['7+ years in Data Science / ML', 'Strong Python, PySpark, and Spark', 'Experience with MLflow or similar MLOps tools', 'People management experience a plus'],
      url: 'https://flipkartcareers.com',
      source: 'LinkedIn',
      salary_range: '₹40,00,000 – ₹65,00,000',
      tags: ['ML', 'Leadership', 'Hybrid'],
    },
    {
      id: 'j4',
      title: 'Analytics Manager',
      company: 'Zomato',
      location: 'Gurugram, India (Onsite)',
      description: 'Lead analytics for our hyperlocal delivery operations. Define KPIs, mentor analysts, build a culture of data-driven decision-making, and present weekly business performance reviews to leadership.',
      requirements: ['5+ years analytics with 2+ years management', 'Proficiency in SQL, Python, and Excel', 'Experience with food-tech or logistics analytics', 'Strong communication and storytelling skills'],
      url: 'https://zomato.com/careers',
      source: 'Glassdoor',
      salary_range: '₹30,00,000 – ₹45,00,000',
      tags: ['Management', 'Operations', 'Onsite'],
    },
    {
      id: 'j5',
      title: 'Senior Data Analyst – Growth',
      company: 'CRED',
      location: 'Bangalore, India (Hybrid)',
      description: 'Drive growth analytics for India\'s premium credit card platform. Build cohort analyses, retention models, and channel attribution dashboards. Own acquisition and activation funnel reporting.',
      requirements: ['4+ years in growth or marketing analytics', 'SQL expert, Python (pandas/numpy)', 'Attribution modeling and cohort analysis', 'Experience with Mixpanel or Amplitude'],
      url: 'https://careers.cred.club',
      source: 'LinkedIn',
      salary_range: '₹22,00,000 – ₹35,00,000',
      tags: ['Growth', 'FinTech', 'Hybrid'],
    },
    {
      id: 'j6',
      title: 'Data Engineer – Pipelines',
      company: 'Razorpay',
      location: 'Bangalore, India (Remote)',
      description: 'Build and maintain scalable data pipelines on AWS using Spark, Kafka, and dbt. Design the lakehouse architecture, ensure SLA compliance, and collaborate with analysts to model data for self-serve analytics.',
      requirements: ['3+ years Data Engineering', 'Python, PySpark, dbt, Airflow', 'AWS (S3, Redshift, Glue) or GCP equivalent', 'Experience with streaming pipelines (Kafka, Kinesis)'],
      url: 'https://razorpay.com/jobs',
      source: 'AngelList',
      salary_range: '₹25,00,000 – ₹40,00,000',
      tags: ['Engineering', 'Remote', 'FinTech'],
    },
    {
      id: 'j7',
      title: 'Business Intelligence Developer',
      company: 'Infosys',
      location: 'Pune, India (Hybrid)',
      description: 'Develop enterprise BI solutions using Power BI and Tableau. Build self-serve dashboards for finance, operations, and HR teams. Optimize DAX queries and maintain ETL processes in SSIS.',
      requirements: ['4+ years BI development', 'Power BI, DAX, Tableau', 'SQL Server, SSIS, Azure Data Factory', 'Communication skills for business stakeholders'],
      url: 'https://infosys.com/careers',
      source: 'LinkedIn',
      salary_range: '₹15,00,000 – ₹22,00,000',
      tags: ['BI', 'Hybrid', 'Enterprise'],
    },
    {
      id: 'j8',
      title: 'ML Engineer – Recommendations',
      company: 'Hotstar (Star India)',
      location: 'Mumbai, India (Hybrid)',
      description: 'Build and improve content recommendation systems serving 50M+ DAUs. Experiment with collaborative filtering, deep learning ranking models, and real-time feature pipelines.',
      requirements: ['3+ years ML Engineering', 'Python, TensorFlow or PyTorch', 'Experience with recommendation systems', 'Familiarity with A/B testing and online experiments'],
      url: 'https://careers.hotstar.com',
      source: 'Naukri',
      salary_range: '₹28,00,000 – ₹45,00,000',
      tags: ['ML', 'RecSys', 'OTT'],
    },
    {
      id: 'j9',
      title: 'Senior Analyst – Decision Science',
      company: 'Amazon',
      location: 'Hyderabad, India (Hybrid)',
      description: 'Partner with operations and supply chain teams to build statistical models for inventory optimization, fulfillment planning, and vendor analytics. Translate complex models into clear recommendations for non-technical stakeholders.',
      requirements: ['4+ years in analytics / decision science', 'SQL, R or Python for statistical modeling', 'Experience with optimization or simulation models', 'Strong business acumen'],
      url: 'https://amazon.jobs',
      source: 'LinkedIn',
      salary_range: '₹32,00,000 – ₹52,00,000',
      tags: ['Operations', 'E-commerce', 'Hybrid'],
    },
    {
      id: 'j10',
      title: 'Analytics Consultant – Data Strategy',
      company: 'Deloitte',
      location: 'Mumbai / Bangalore, India (Hybrid)',
      description: 'Help enterprise clients define their data strategy, evaluate analytics maturity, and implement modern data platforms. Own client-facing deliverables and manage junior analysts on engagements.',
      requirements: ['5+ years analytics consulting or strategy', 'Cloud data platforms (Azure, AWS, GCP)', 'Data governance and MDM knowledge', 'Client management experience'],
      url: 'https://deloitte.com/in/careers',
      source: 'Glassdoor',
      salary_range: '₹28,00,000 – ₹44,00,000',
      tags: ['Consulting', 'Strategy', 'Hybrid'],
    },
    {
      id: 'j11',
      title: 'Junior Data Analyst',
      company: 'Swiggy',
      location: 'Bangalore, India (Remote)',
      description: 'Support the city operations team with regular reporting, ad hoc analysis, and experimentation insights. Work with SQL and Python to extract, clean, and visualize operational data.',
      requirements: ['1–2 years data analysis experience', 'Proficiency in SQL and Excel', 'Basic Python (pandas) skills', 'Good communication skills'],
      url: 'https://swiggy.com/careers',
      source: 'Naukri',
      salary_range: '₹8,00,000 – ₹14,00,000',
      tags: ['Entry Level', 'Remote', 'Food-tech'],
    },
    {
      id: 'j12',
      title: 'Staff Data Scientist',
      company: 'Phonepe',
      location: 'Bangalore, India (Hybrid)',
      description: 'Lead research and development of next-gen fraud detection models using ML and graph analytics. Define technical direction for a squad of 6 data scientists. Publish research and represent PhonePe at conferences.',
      requirements: ['8+ years Data Science / Research', 'Deep ML expertise (transformers, graph NNs)', 'Experience with fraud, risk, or anomaly detection', 'Publications or patents preferred'],
      url: 'https://phonepe.com/careers',
      source: 'LinkedIn',
      salary_range: '₹60,00,000 – ₹90,00,000',
      tags: ['Staff', 'Research', 'FinTech'],
    },
  ];
}
