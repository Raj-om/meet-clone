# Database Entity-Relationship Diagram (ERD) & Schema Specification
## Project: Online Video Meeting — A Step Towards Atma Nirbhar Bharat

### 1. Entity-Relationship Diagram (ERD)
```mermaid
erDiagram
    USER ||--o{ ACCOUNT : "authenticates_via"
    USER ||--o{ SESSION : "maintains"
    USER ||--o{ MEETING : "hosts"
    
    MEETING ||--o{ EXAM_RESULT : "records"
    MEETING ||--o{ INTERVIEW_RESULT : "evaluates"
    MEETING ||--o{ CLASSROOM_ENGAGEMENT : "monitors"

    USER {
        string id PK "cuid()"
        string name "User full name"
        string email UK "Unique email address"
        datetime emailVerified "Nullable verification date"
        string image "Avatar URL"
        string password "Salted bcrypt hash"
    }

    ACCOUNT {
        string id PK "cuid()"
        string userId FK "References USER(id)"
        string type "OAuth account type"
        string provider "OAuth provider (e.g. google)"
        string providerAccountId "Provider user ID"
        string refresh_token "OAuth refresh token"
        string access_token "OAuth access token"
        int expires_at "Token expiry timestamp"
    }

    SESSION {
        string id PK "cuid()"
        string sessionToken UK "NextAuth session token"
        string userId FK "References USER(id)"
        datetime expires "Session expiration timestamp"
    }

    MEETING {
        string id PK "cuid()"
        string roomId UK "Unique room slug / meeting ID"
        string title "Meeting title"
        string hostId FK "References USER(id)"
        datetime scheduledAt "Scheduled meeting time"
        string passcode "Optional room entry passcode"
        datetime createdAt "Record creation timestamp"
    }

    EXAM_RESULT {
        string id PK "cuid()"
        string meetingId FK "References MEETING(id)"
        string studentId "Student unique identifier"
        string studentName "Student display name"
        float score "Total score achieved"
        float plagiarismRisk "Aggregate risk score (0-100)"
        string violations "JSON string array of violations"
        datetime submittedAt "Submission timestamp"
    }

    INTERVIEW_RESULT {
        string id PK "cuid()"
        string meetingId FK "References MEETING(id)"
        string candidateId "Candidate unique identifier"
        string candidateName "Candidate display name"
        float confidenceScore "AI confidence index (0-100)"
        float eyeContact "Eye contact ratio (0-100)"
        float voiceStress "Vocal stress index (0-100)"
        int speakingTimeMs "Speaking duration in ms"
        string flags "JSON string array of flags"
        datetime createdAt "Interview timestamp"
    }

    CLASSROOM_ENGAGEMENT {
        string id PK "cuid()"
        string meetingId FK "References MEETING(id)"
        string studentId "Student identifier"
        string studentName "Student display name"
        float averageScore "Engagement score average (0-100)"
        int attendanceTime "Minutes attended"
        datetime joinedAt "Join timestamp"
        datetime disconnectedAt "Departure timestamp"
    }
```

### 2. Relational Integrity Rules
* **Cascading Deletions:** Deleting a `User` cascades to delete all associated `Account`, `Session`, and `Meeting` records (`onDelete: Cascade`).
* **Meeting Sub-Entities:** Deleting a `Meeting` cascades to purge all associated `ExamResult`, `InterviewResult`, and `ClassroomEngagement` records.
* **Unique Constraints:** Enforced on `User.email`, `Meeting.roomId`, `Session.sessionToken`, and compound unique on `[Account.provider, Account.providerAccountId]`.
