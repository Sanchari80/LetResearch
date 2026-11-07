// Demo data for LetResearch. Creates sample researchers, papers, posts, connections,
// a conversation, a message request and notifications so the app is easy to explore.
//
//   npm run seed            → seeds an empty database
//   npm run seed -- --reset → WIPES the whole database first, then seeds
//
// Every demo account uses the password: Research@123
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDatabase } from '../db.js';
import {
  Comment,
  Connection,
  Conversation,
  Message,
  Notification,
  Paper,
  PaperDownload,
  Post,
  User,
  pairKeyOf,
} from '../models/index.js';
import { saveFile } from '../services/files.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PASSWORD = 'Research@123';
const reset = process.argv.includes('--reset');

const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000);

/** Builds a small, valid one-page PDF so file downloads can be tried immediately. */
function makePdf(title, lines) {
  const esc = (s) =>
    String(s)
      .replace(/[\\()]/g, (c) => `\\${c}`)
      .replace(/[^\x20-\x7e]/g, '-');
  const content = [
    'BT /F2 16 Tf 56 780 Td',
    `(${esc(title.slice(0, 70))}) Tj`,
    'ET',
    'BT /F1 11 Tf 56 750 Td 15 TL',
    ...lines.map((l) => `(${esc(l)}) Tj T*`),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const RESEARCHERS = [
  {
    key: 'nusrat',
    name: 'Nusrat Jahan',
    email: 'nusrat.jahan@example.com',
    username: 'nusrat-jahan',
    headline: 'Associate Professor of Computational Biology',
    openToCollaborate: true,
    profile: {
      qualification: 'PhD in Bioinformatics',
      institution: 'University of Dhaka',
      location: 'Dhaka, Bangladesh',
      bio: 'I build machine-learning methods for genomics in low-resource settings – from crop pathogens to clinical sequencing. Currently leading a rice pathogen surveillance project with partners across Bangladesh.',
      interests: ['Bioinformatics', 'Machine Learning', 'Genomics', 'Crop Science'],
    },
    links: {
      email: 'nusrat.jahan@example.com',
      whatsapp: '+8801700000001',
      linkedin: 'https://www.linkedin.com/in/example-nusrat',
      github: 'https://github.com/example-nusrat',
      scholar: 'https://scholar.google.com/citations?user=example',
      orcid: '0000-0002-1825-0097',
      portfolio: 'https://example.com/nusrat',
    },
  },
  {
    key: 'arif',
    name: 'Arif Hossain',
    email: 'arif.hossain@example.com',
    username: 'arif-hossain',
    headline: 'PhD Candidate in Electrical Engineering',
    profile: {
      qualification: 'MSc in Electrical Engineering',
      institution: 'Bangladesh University of Engineering and Technology',
      location: 'Dhaka, Bangladesh',
      bio: 'Grid-scale storage, solar forecasting and power systems for South Asian grids.',
      interests: ['Renewable Energy', 'Power Systems', 'Machine Learning'],
    },
    links: {
      linkedin: 'https://www.linkedin.com/in/example-arif',
      whatsapp: '+8801700000002',
      github: 'https://github.com/example-arif',
    },
  },
  {
    key: 'elena',
    name: 'Elena Marković',
    email: 'elena.markovic@example.com',
    username: 'elena-markovic',
    headline: 'Postdoctoral Researcher, Climate Science',
    openToCollaborate: true,
    profile: {
      qualification: 'PhD in Atmospheric Physics',
      institution: 'ETH Zurich',
      location: 'Zurich, Switzerland',
      bio: 'Regional climate models, monsoon variability and satellite hydrology.',
      interests: ['Climate Modeling', 'Remote Sensing', 'Hydrology', 'Machine Learning'],
    },
    links: {
      linkedin: 'https://www.linkedin.com/in/example-elena',
      researchgate: 'https://www.researchgate.net/profile/Example',
    },
  },
  {
    key: 'kenji',
    name: 'Kenji Watanabe',
    email: 'kenji.watanabe@example.com',
    username: 'kenji-watanabe',
    headline: 'Research Scientist, Battery Materials',
    profile: {
      qualification: 'PhD in Materials Science',
      institution: 'University of Tokyo',
      location: 'Tokyo, Japan',
      bio: 'Silicon–graphite anodes, coatings and degradation mechanisms in lithium-ion cells.',
      interests: ['Battery Materials', 'Nanotechnology', 'Renewable Energy'],
    },
    links: { linkedin: 'https://www.linkedin.com/in/example-kenji' },
  },
  {
    key: 'amara',
    name: 'Amara Okafor',
    email: 'amara.okafor@example.com',
    username: 'amara-okafor',
    headline: 'Lecturer in Public Health',
    profile: {
      qualification: 'DrPH in Epidemiology',
      institution: 'University of Lagos',
      location: 'Lagos, Nigeria',
      bio: 'Disease surveillance, health systems and open epidemiological data.',
      interests: ['Epidemiology', 'Global Health', 'Data Science'],
    },
    links: { linkedin: 'https://www.linkedin.com/in/example-amara', twitter: 'example_amara' },
  },
  {
    key: 'sadia',
    name: 'Sadia Rahman',
    email: 'sadia.rahman@example.com',
    username: 'sadia-rahman',
    headline: 'MSc Student, Natural Language Processing',
    openToCollaborate: true,
    profile: {
      qualification: 'BSc in Computer Science',
      institution: 'North South University',
      location: 'Dhaka, Bangladesh',
      bio: 'Low-resource NLP for Bangla: tokenization, speech and evaluation benchmarks.',
      interests: ['Natural Language Processing', 'Machine Learning', 'Bangla NLP'],
    },
    links: { github: 'https://github.com/example-sadia', telegram: 'example_sadia' },
  },
  {
    key: 'michael',
    name: 'Michael Chen',
    email: 'michael.chen@example.com',
    username: 'michael-chen',
    headline: 'Professor of Neuroscience',
    profile: {
      qualification: 'PhD in Neuroscience',
      institution: 'University of Toronto',
      location: 'Toronto, Canada',
      bio: 'Brain imaging, computational psychiatry and reproducible neuroimaging pipelines.',
      interests: ['Neuroscience', 'Brain Imaging', 'Machine Learning'],
    },
    links: { linkedin: 'https://www.linkedin.com/in/example-michael', portfolio: 'https://example.com/chen-lab' },
  },
  {
    key: 'laila',
    name: 'Laila Haddad',
    email: 'laila.haddad@example.com',
    username: 'laila-haddad',
    headline: 'Research Fellow in Development Economics',
    profile: {
      qualification: 'PhD in Economics',
      institution: 'American University of Beirut',
      location: 'Beirut, Lebanon',
      bio: 'Agricultural markets, climate shocks and household resilience.',
      interests: ['Development Economics', 'Policy', 'Data Science', 'Crop Science'],
    },
    links: { linkedin: 'https://www.linkedin.com/in/example-laila' },
  },
];

async function main() {
  await connectDatabase();
  const existing = await User.countDocuments();
  if (existing > 0 && !reset) {
    console.log('The database already has users. Run "npm run seed -- --reset" to wipe it and load demo data.');
    await mongoose.disconnect();
    return;
  }
  if (reset) {
    console.log('Wiping database…');
    await mongoose.connection.db.dropDatabase();
    await Promise.all(
      [User, Connection, Paper, PaperDownload, Post, Comment, Conversation, Message, Notification].map((m) => m.syncIndexes()),
    );
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users = {};
  for (const r of RESEARCHERS) {
    users[r.key] = await User.create({ ...r, passwordHash, lastSeenAt: minutesAgo(Math.floor(Math.random() * 300)) });
  }
  const id = (key) => users[key]._id;
  console.log(`Created ${RESEARCHERS.length} researchers`);

  // Connections
  const connect = async (a, b, status = 'accepted', ago = 2000) =>
    Connection.create({
      requester: id(a),
      recipient: id(b),
      pairKey: pairKeyOf(id(a), id(b)),
      status,
      respondedAt: status === 'accepted' ? minutesAgo(ago) : null,
      createdAt: minutesAgo(ago + 30),
    });
  await connect('arif', 'nusrat', 'accepted', 9000);
  await connect('nusrat', 'sadia', 'accepted', 7000);
  await connect('elena', 'nusrat', 'accepted', 5000);
  await connect('amara', 'elena', 'accepted', 4000);
  await connect('kenji', 'arif', 'accepted', 3000);
  await connect('sadia', 'arif', 'accepted', 2500);
  const pending = await connect('michael', 'nusrat', 'pending', 90);
  await connect('nusrat', 'amara', 'pending', 600);

  // Papers
  const addPaper = async (owner, data, order, pdfLines) => {
    const paper = new Paper({ owner: id(owner), order, ...data });
    if (data.kind === 'file') {
      const name = `${data.title.slice(0, 48).replace(/[^\w]+/g, '-')}.pdf`;
      const buffer = makePdf(
        data.title,
        pdfLines || [data.venue || 'Working paper', `${data.authors.join(', ')}`, '', 'Demo document generated for LetResearch.'],
      );
      const fileId = await saveFile({
        buffer,
        filename: name,
        mime: 'application/pdf',
        kind: 'paper',
        owner: id(owner),
        access: 'private',
      });
      paper.file = { id: fileId, name, mime: 'application/pdf', size: buffer.length };
    }
    await paper.save();
    return paper;
  };

  const p1 = await addPaper(
    'nusrat',
    {
      kind: 'link',
      title: 'Deep Learning Approaches for Predicting Protein–Ligand Binding Affinity in Low-Resource Settings',
      abstract:
        'We compare graph neural networks with attention against convolutional baselines for binding-affinity prediction when labelled data is scarce. Pre-training on public structures and fine-tuning on 2,000 local assays improves accuracy by 6.4 points while halving compute.',
      authors: ['Nusrat Jahan', 'Sadia Rahman', 'Arif Hossain'],
      venue: 'Bioinformatics Advances',
      year: 2025,
      doi: '10.5555/letresearch.demo.001',
      link: 'https://doi.org/10.5555/letresearch.demo.001',
      keywords: ['graph neural networks', 'drug discovery', 'transfer learning'],
      viewAccess: 'public',
      downloadAccess: 'everyone',
    },
    0,
  );
  const p2 = await addPaper(
    'nusrat',
    {
      kind: 'file',
      title: 'A Benchmark Dataset of Bangladeshi Rice Pathogen Genomes',
      abstract:
        'We release 412 annotated Magnaporthe oryzae genomes sampled across seven districts, with a reproducible pipeline for variant calling and resistance-gene screening.',
      authors: ['Nusrat Jahan', 'Laila Haddad'],
      venue: 'Scientific Data',
      year: 2024,
      keywords: ['rice blast', 'genomics', 'dataset'],
      viewAccess: 'public',
      downloadAccess: 'connections',
    },
    1,
  );
  const p3 = await addPaper(
    'nusrat',
    {
      kind: 'link',
      title: 'Graph Neural Networks for Gene Regulatory Network Inference: A Survey',
      abstract:
        'A survey of 120 GNN-based methods for inferring gene regulatory networks from single-cell data, with a taxonomy and open benchmark.',
      authors: ['Nusrat Jahan', 'Elena Marković'],
      venue: 'Briefings in Bioinformatics',
      year: 2023,
      link: 'https://arxiv.org/abs/2301.00001',
      keywords: ['survey', 'single-cell', 'GNN'],
      viewAccess: 'connections',
      downloadAccess: 'connections',
    },
    2,
  );
  const p4 = await addPaper(
    'nusrat',
    {
      kind: 'file',
      title: 'Federated Learning for Privacy-Preserving Clinical Genomics',
      abstract:
        'Hospitals train a shared variant-pathogenicity model without moving patient data. We evaluate across four sites and discuss governance.',
      authors: ['Nusrat Jahan', 'Amara Okafor', 'Michael Chen'],
      venue: 'Journal of Biomedical Informatics',
      year: 2024,
      keywords: ['federated learning', 'privacy', 'clinical genomics'],
      viewAccess: 'public',
      downloadAccess: 'none',
    },
    3,
  );
  await addPaper(
    'nusrat',
    {
      kind: 'file',
      title: 'Draft: Single-cell Atlas of Sundarbans Mangrove Microbiomes',
      abstract: 'Work in progress – not for circulation.',
      authors: ['Nusrat Jahan'],
      venue: 'Manuscript in preparation',
      year: 2026,
      keywords: ['microbiome', 'mangrove'],
      viewAccess: 'private',
      downloadAccess: 'none',
    },
    4,
  );
  await addPaper(
    'nusrat',
    {
      kind: 'link',
      title: 'Teaching Notes: Practical Bioinformatics with Python',
      abstract: 'Course notes for an undergraduate bioinformatics lab.',
      authors: ['Nusrat Jahan'],
      venue: 'Course material',
      year: 2022,
      link: 'https://example.com/teaching-notes',
      viewAccess: 'public',
      downloadAccess: 'everyone',
      showOnProfile: false,
    },
    5,
  );

  const pa1 = await addPaper(
    'arif',
    {
      kind: 'file',
      title: 'Short-Term Solar Forecasting for the Bangladesh Grid Using Sky Images',
      abstract:
        'A hybrid CNN–LSTM model forecasts 15-minute solar output from sky-camera images with 11% lower error than persistence.',
      authors: ['Arif Hossain', 'Kenji Watanabe'],
      venue: 'IEEE Transactions on Sustainable Energy',
      year: 2025,
      keywords: ['solar forecasting', 'deep learning'],
      viewAccess: 'public',
      downloadAccess: 'everyone',
    },
    0,
  );
  await addPaper(
    'arif',
    {
      kind: 'link',
      title: 'Battery Storage Sizing for Rural Microgrids',
      abstract: 'Optimization framework for sizing storage in off-grid villages.',
      authors: ['Arif Hossain'],
      venue: 'Energy Reports',
      year: 2024,
      doi: '10.5555/letresearch.demo.014',
      link: 'https://doi.org/10.5555/letresearch.demo.014',
      viewAccess: 'connections',
      downloadAccess: 'connections',
    },
    1,
  );
  await addPaper(
    'elena',
    {
      kind: 'link',
      title: 'Monsoon Onset Shifts in CMIP7 Regional Downscaling',
      abstract: 'Downscaled projections suggest a 6–9 day delay in monsoon onset over the Bengal delta by 2060.',
      authors: ['Elena Marković', 'Nusrat Jahan'],
      venue: 'Geophysical Research Letters',
      year: 2025,
      link: 'https://arxiv.org/abs/2502.00002',
      viewAccess: 'public',
      downloadAccess: 'everyone',
    },
    0,
  );
  const pk1 = await addPaper(
    'kenji',
    {
      kind: 'file',
      title: 'Alumina Coatings Extend Cycle Life of Silicon–Graphite Anodes',
      abstract: 'Atomic-layer-deposited alumina keeps 89% capacity after 1,000 cycles.',
      authors: ['Kenji Watanabe'],
      venue: 'ACS Energy Letters',
      year: 2025,
      viewAccess: 'public',
      downloadAccess: 'everyone',
    },
    0,
  );
  await addPaper(
    'sadia',
    {
      kind: 'link',
      title: 'BanglaBench: Evaluating Tokenizers for Bangla Language Models',
      abstract: 'A benchmark for subword tokenizers on Bangla news, social and legal text.',
      authors: ['Sadia Rahman', 'Nusrat Jahan'],
      venue: 'Findings of ACL',
      year: 2025,
      link: 'https://arxiv.org/abs/2503.00003',
      viewAccess: 'public',
      downloadAccess: 'everyone',
    },
    0,
  );
  console.log('Created papers');

  // Post media
  const figure = async (owner, file) =>
    saveFile({
      buffer: await fs.readFile(path.join(here, 'seed-assets', file)),
      filename: file,
      mime: 'image/png',
      kind: 'post',
      owner: id(owner),
      access: 'public',
    });

  const posts = [];
  const addPost = async (author, data, ago) => {
    const post = await Post.create({
      author: id(author),
      audience: 'public',
      ...data,
      createdAt: minutesAgo(ago),
      updatedAt: minutesAgo(ago),
    });
    posts.push(post);
    return post;
  };

  const post1 = await addPost(
    'nusrat',
    {
      kind: 'media',
      category: 'Research update',
      text: 'New result from our binding-affinity project: the attention-based GNN reaches 0.93 validation accuracy with only 2,000 local assays. Figure shows the comparison with our CNN baseline across 40 epochs. Preprint coming next month.',
      media: [{ id: await figure('nusrat', 'figure-accuracy.png'), kind: 'image', mime: 'image/png', access: 'public' }],
    },
    50,
  );
  await addPost(
    'kenji',
    {
      kind: 'media',
      category: 'Publication',
      text: 'Our alumina-coated silicon–graphite anodes keep 89% capacity after 1,000 cycles at 1C. Full methods and raw cycling data are in the paper.',
      media: [{ id: await figure('kenji', 'figure-battery.png'), kind: 'image', mime: 'image/png', access: 'public' }],
    },
    180,
  );
  await addPost(
    'nusrat',
    {
      kind: 'paper',
      category: 'Publication',
      text: 'Our rice pathogen genome dataset is out. 412 annotated genomes from seven districts, with the full variant-calling pipeline. Connections can download the PDF directly here.',
      paper: p2._id,
    },
    400,
  );
  await addPost(
    'laila',
    {
      kind: 'media',
      category: 'Research update',
      text: 'Field survey results: rice blast incidence fell in every district we sampled after the resistant-variety rollout. Next step is linking this to household income data.',
      media: [{ id: await figure('laila', 'figure-rice-blast.png'), kind: 'image', mime: 'image/png', access: 'public' }],
    },
    620,
  );
  await addPost(
    'elena',
    {
      kind: 'link',
      category: 'Preprint',
      text: 'Preprint: downscaled CMIP7 projections suggest monsoon onset over the Bengal delta shifts 6–9 days later by 2060. Feedback from hydrologists very welcome.',
      link: { url: 'https://arxiv.org/abs/2502.00002', domain: 'arxiv.org' },
    },
    900,
  );
  await addPost(
    'sadia',
    {
      kind: 'update',
      category: 'Collaboration call',
      text: 'Looking for collaborators with Bangla speech corpora for a tokenizer evaluation study. We can share our annotation guidelines and evaluation scripts. Reply here or message me.',
    },
    1300,
  );
  await addPost(
    'arif',
    {
      kind: 'paper',
      category: 'Publication',
      text: 'Accepted in IEEE Transactions on Sustainable Energy: short-term solar forecasting from sky images for the Bangladesh grid.',
      paper: pa1._id,
    },
    2000,
  );
  await addPost(
    'amara',
    {
      kind: 'update',
      category: 'Conference & events',
      text: 'Our workshop on open epidemiological data runs at the Global Health Data Summit next month. Abstract submissions close on the 30th – early-career researchers are especially encouraged to submit.',
    },
    2600,
  );
  await addPost(
    'michael',
    {
      kind: 'update',
      category: 'Academic question',
      text: 'Question for the imaging community: what is your current approach to harmonizing MRI scans across scanner vendors? We are comparing ComBat variants and would love to hear what works in practice.',
    },
    3100,
  );
  await addPost(
    'kenji',
    {
      kind: 'paper',
      category: 'Publication',
      text: 'Paper and supplementary cycling data for the alumina-coating study are available below.',
      paper: pk1._id,
    },
    3500,
  );

  // Likes and comments
  const like = async (post, keys) => {
    await Post.updateOne({ _id: post._id }, { $addToSet: { likes: { $each: keys.map(id) } }, $set: { likeCount: keys.length } });
  };
  await like(post1, ['arif', 'sadia', 'elena', 'kenji']);
  await like(posts[1], ['arif', 'nusrat']);
  await like(posts[3], ['nusrat', 'amara', 'elena']);
  const comment = async (post, author, text, ago) => {
    await Comment.create({ post: post._id, author: id(author), text, createdAt: minutesAgo(ago) });
    await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
  };
  await comment(post1, 'arif', 'Impressive gain with so few assays. Did you try freezing the first message-passing layers?', 40);
  await comment(post1, 'sadia', 'The pre-training trick was the key. Happy to share the config.', 35);
  await comment(posts[3], 'nusrat', 'This lines up with our genome sampling – would love to compare districts.', 600);
  console.log('Created posts, likes and comments');

  // Conversation between Nusrat and Arif
  const conversation = await Conversation.create({
    participants: [id('nusrat'), id('arif')],
    pairKey: pairKeyOf(id('nusrat'), id('arif')),
    status: 'active',
    acceptedAt: minutesAgo(8000),
  });
  const chat = [
    ['arif', 'Hi Nusrat, I read the binding-affinity preprint draft. The ablation table is very clear.', 120],
    ['nusrat', 'Thanks Arif! Could you check whether the solar dataset loader works with our new pipeline?', 115],
    ['arif', 'Sure – I will run it on the lab server tonight and send you the logs.', 110],
    ['arif', 'Done. Everything passes except the timezone conversion; I opened an issue on GitHub.', 25],
  ];
  let last;
  for (const [from, text, ago] of chat) {
    last = await Message.create({
      conversation: conversation._id,
      sender: id(from),
      text,
      createdAt: minutesAgo(ago),
      readAt: ago > 100 ? minutesAgo(ago - 2) : null,
    });
  }
  conversation.lastMessage = { text: last.text, kind: 'text', sender: last.sender, createdAt: last.createdAt };
  conversation.lastMessageAt = last.createdAt;
  conversation.unread.set(String(id('nusrat')), 1);
  await conversation.save();

  // Message request from Laila (not connected) to Nusrat
  const request = await Conversation.create({
    participants: [id('laila'), id('nusrat')],
    pairKey: pairKeyOf(id('laila'), id('nusrat')),
    status: 'request',
    requestedBy: id('laila'),
  });
  const reqMsg = await Message.create({
    conversation: request._id,
    sender: id('laila'),
    text: 'Hello Dr. Jahan – I work on rice markets and climate shocks. Would you be open to linking your pathogen data with our household survey?',
    createdAt: minutesAgo(30),
  });
  request.lastMessage = { text: reqMsg.text, kind: 'text', sender: reqMsg.sender, createdAt: reqMsg.createdAt };
  request.lastMessageAt = reqMsg.createdAt;
  request.unread.set(String(id('nusrat')), 1);
  await request.save();

  // Downloads + notifications for Nusrat
  await PaperDownload.create({ paper: p2._id, owner: id('nusrat'), user: id('arif'), kind: 'file', createdAt: minutesAgo(15) });
  await Paper.updateOne({ _id: p2._id }, { $inc: { 'stats.downloads': 1, 'stats.views': 14 } });
  await Paper.updateOne({ _id: p1._id }, { $inc: { 'stats.views': 32, 'stats.downloads': 6 } });
  await Paper.updateOne({ _id: p3._id }, { $inc: { 'stats.views': 9 } });
  await Paper.updateOne({ _id: p4._id }, { $inc: { 'stats.views': 21 } });
  const n = (data, ago, read = false) =>
    Notification.create({ ...data, recipient: id('nusrat'), read, createdAt: minutesAgo(ago) });
  await n({ actor: id('arif'), type: 'paper_download', paper: p2._id, snippet: 'file' }, 15);
  await n({ actor: id('laila'), type: 'message_request', conversation: request._id }, 30);
  await n({ actor: id('michael'), type: 'connection_request', connection: pending._id }, 90);
  await n(
    {
      actor: id('sadia'),
      type: 'post_comment',
      post: post1._id,
      snippet: 'The pre-training trick was the key. Happy to share the config.',
    },
    35,
  );
  await n({ actor: id('arif'), type: 'post_comment', post: post1._id, snippet: 'Impressive gain with so few assays.' }, 40, true);
  await n({ actor: id('elena'), type: 'post_like', post: post1._id }, 44, true);
  await n({ actor: id('kenji'), type: 'post_like', post: post1._id }, 46, true);

  console.log('\nDemo data ready. Sign in with any of these accounts (password: Research@123):');
  for (const r of RESEARCHERS) console.log(`  ${r.email.padEnd(32)} ${r.name}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
