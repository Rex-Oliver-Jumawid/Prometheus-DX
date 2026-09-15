# Company Context

## Overview

The company is a software development startup that creates software solutions for external clients.

Its work involves understanding client needs, planning solutions, designing interfaces and assets, developing software, testing outputs, communicating with clients, and supporting projects through completion.

As the company grows, more work needs to be coordinated across multiple people and departments.

The company currently operates through three primary teams:

- Research and Development (R&D)
- Creatives
- Sales and Marketing (S&M)

Although each team has its own responsibilities, client projects often require collaboration between two or all three departments.

Because of this, the company needs a shared working environment where employees can coordinate projects, tasks, schedules, communication, and responsibilities.

---

## Organizational Structure

### Research and Development (R&D)

R&D is responsible for the technical development of the company's software solutions.

Its responsibilities may include:

- Requirements analysis
- Technical research
- System architecture
- Frontend development
- Backend development
- Database development
- Integration
- Testing and quality assurance
- Deployment
- Maintenance
- Technical troubleshooting

R&D is generally responsible for turning client requirements and approved designs into functional software.

---

### Creatives

The Creatives team is responsible for the visual, design, and creative aspects of company and client work.

Its responsibilities may include:

- UI/UX design
- Wireframing
- Prototyping
- Graphic design
- Branding
- Presentation materials
- Marketing assets
- Design systems
- Other visual assets required by projects

Creatives may work directly with R&D when designing software interfaces and with S&M when preparing client-facing or marketing materials.

---

### Sales and Marketing (S&M)

Sales and Marketing is responsible for acquiring clients, maintaining client relationships, and promoting the company and its services.

Its responsibilities may include:

- Lead generation
- Client inquiries
- Client communication
- Sales discussions
- Proposal preparation
- Client onboarding
- Account management
- Marketing campaigns
- Social media and promotional activities
- Partnerships
- Market research

S&M often serves as one of the first points of contact between the company and a potential client.

Once a client engagement becomes a project, S&M may continue participating as the communication bridge between the client and the internal project team.

---

## Current Project Environment

The company's projects are primarily client-driven.

A typical project may begin when S&M receives or generates a client opportunity.

The team communicates with the client to understand the client's needs, expectations, scope, and business objectives.

Once the project is approved, internal work may be distributed across R&D, Creatives, and S&M depending on the project's requirements.

A single project may therefore involve people from several departments.

For example, a client software project may involve:

- S&M managing client communication and expectations
- Creatives preparing the application's UI/UX design
- R&D developing, testing, and deploying the application

Because projects are cross-functional, departmental boundaries should not prevent employees from collaborating on the same project.

A project should instead form its own temporary working group consisting of the people required to complete it.

---

## Current Collaboration Challenge

The company needs a more centralized way of coordinating its daily operations.

Information related to projects can become distributed across different conversations, documents, meetings, task lists, and individual team members.

This can make it difficult for employees and managers to immediately understand the current state of work.

Common questions that should be easy to answer include:

- What projects are currently active?
- What is the current state of each project?
- What tasks are currently being worked on?
- Who is responsible for each task?
- Which tasks are blocked or delayed?
- What work requires review or approval?
- What changed recently?
- What deadlines are approaching?
- What is each department currently working on?
- Which employees are currently available or occupied?
- What decisions have already been made regarding a project?
- Where are the files, discussions, and updates related to a particular project?

Without a dedicated environment, employees may need to manually gather this information from different sources.

This creates unnecessary communication overhead and makes project visibility more difficult as the number of employees and projects increases.

---

## Need for a Virtual Office

The company intends to develop a dedicated internal system that functions as its virtual office.

The system should become the central workspace where employees can see, organize, and participate in company operations.

Rather than functioning only as a task management application, the platform should represent how the company itself operates.

Employees should be able to enter the system and quickly understand:

- What they need to work on
- What projects they belong to
- What their department is currently working on
- What deadlines and schedules are approaching
- What activities have recently happened
- What requires their attention
- Who they need to collaborate with

The system should reduce the need to jump between disconnected tools just to understand the state of the company.

---

## Department and Project Workspaces

The company has two important organizational perspectives that the system should recognize.

### Department Workspace

A department workspace represents the continuing operations of a specific team.

Examples include:

- R&D Workspace
- Creatives Workspace
- Sales and Marketing Workspace

These workspaces may contain department-level tasks, schedules, discussions, people, activities, and internal initiatives.

Department workspaces should allow team members and managers to understand what their department is currently doing regardless of which client project the work belongs to.

### Project Workspace

A project workspace represents the collaboration environment for a specific project.

Unlike a department workspace, a project workspace may contain employees from multiple departments.

For example:

```text
Project: Client Management System

Project Lead
└── R&D

Frontend Developer
└── R&D

Backend Developer
└── R&D

UI/UX Designer
└── Creatives

Account Manager
└── Sales & Marketing
```

The project workspace should become the primary location for information specifically related to that project.

This may eventually include project tasks, discussions, files, milestones, reviews, progress, participants, and project activity.

---

## Nature of Software Development Work

The company's project workflow should reflect the iterative nature of software development.

Software projects do not always move through phases in one direction.

A simplified lifecycle may appear as:

```text
Planning
→ Design
→ Development
→ Testing
→ Deployment
→ Completed
```

In practice, work frequently moves between these activities.

Testing may discover a problem that requires additional development.

Development may uncover a requirement that needs additional design work.

Client feedback may cause previously completed functionality to be revised.

Because of this, the internal system should not assume that every software project follows a strictly linear process.

Project phases should describe the general state of the project, while individual tasks should have their own workflow.

An example task workflow may be:

```text
Backlog
→ Ready
→ In Progress
→ For Review
→ Testing
→ Done
```

Tasks may move backward when revisions are required.

This makes the system compatible with an Agile and iterative development environment.

---

## Current Operational Direction

The objective is not simply to recreate Jira, Slack, Notion, or another existing productivity platform.

The goal is to build a system around the actual operating model of the company.

Concepts from existing project management and collaboration tools may be adopted when they solve a real company need.

However, features should be designed around the company's workflow rather than added simply because another platform contains them.

The system should gradually become the company's primary internal environment for:

- Project management
- Task management
- Department coordination
- Cross-functional collaboration
- Team schedules
- Internal communication
- Project discussions
- Reviews and approvals
- Client-related coordination
- File and information organization
- Activity visibility
- Work progress monitoring

---

## Core Design Principle

The virtual office should answer a simple question for every employee:

**"What is happening in the company, and what do I need to do next?"**

The platform should provide enough context for employees to understand their responsibilities without requiring them to manually reconstruct information from several different tools or conversations.

At the same time, the system should avoid overwhelming employees with information that is unrelated to their role, department, or projects.

The long-term objective is to create a shared digital workspace that makes the company's operations visible, organized, collaborative, and easier to manage as the startup grows.