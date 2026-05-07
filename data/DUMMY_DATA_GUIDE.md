# Dummy Data Guide

This guide explains how to use the `dummy-data.json` file to populate your app with test data without requiring a backend.

## File Structure

The `dummy-data.json` file contains the following sections:

### Users (3 entries)
- Represents registered user accounts
- Linked to Students via `studentId`
- Used for authentication/login

### Students (6 entries)
- Represents student records
- Contains major and classification (year in school)
- Linked to Enrollments

### Instructors (3 entries)
- Represents faculty members
- Linked to ClassSections

### Classes (4 entries)
- Represents courses in the catalog
- Identified by `id` format: `{DEPT}-{NUMBER}-{SEMESTER}{YEAR}`
- Contains course details (title, description, credits)
- Linked to ClassSections

### ClassSections (5 entries)
- Represents specific instances of a class
- Links to a Class, an Instructor, and has a capacity
- Linked to ClassSchedules and Enrollments

### ClassSchedules (13 entries)
- Represents meeting times for a class section
- Contains day, start/end times, and location
- Most sections have 3 meetings per week (MWF or TR pattern)

### Enrollments (13 entries)
- Represents student registration in a class section
- `status`: 0 = Enrolled, 1 = Waitlisted
- Contains creation timestamp and position in class/waitlist
- Links student to class section

## Data Relationships

```
User (1) -----> (1) Student
                    |
                    | (many)
                    v
                Enrollment (many) <----- (1) ClassSection
                                             |
                                             | (1)
                                             v
                                         Class (1) <----- (many) ClassSection
                                                              |
                                                              | (1)
                                                              v
                                                         Instructor

ClassSection (1) -----> (many) ClassSchedule
```

## Loading Data in Frontend

### Option 1: Direct JSON Import
```javascript
import dummyData from './dummy-data.json';

// Access individual sections
const users = dummyData.users;
const students = dummyData.students;
const instructors = dummyData.instructors;
const classes = dummyData.classes;
const classSections = dummyData.classSections;
const classSchedules = dummyData.classSchedules;
const enrollments = dummyData.enrollments;
```

### Option 2: Simulated API Responses
```javascript
// Create a mock API service
class MockApiService {
  getStudents() {
    return Promise.resolve(dummyData.students);
  }
  
  getClasses() {
    return Promise.resolve(dummyData.classes);
  }
  
  getClassSections() {
    return Promise.resolve(dummyData.classSections);
  }
  
  getEnrollments() {
    return Promise.resolve(dummyData.enrollments);
  }
}
```

### Option 3: Local Storage
```javascript
// Store in localStorage
localStorage.setItem('dummyData', JSON.stringify(dummyData));

// Retrieve later
const data = JSON.parse(localStorage.getItem('dummyData'));
```

## Test Scenarios

### Full Enrollment Flow
- John Smith (ID: 660e8400..001) is enrolled in CS-101-S26 Section 1 and CS-201-S26
- Sarah Johnson (ID: 660e8400..002) is enrolled in CS-101-S26 (both sections) and CS-301-S26
- Alex Martinez (ID: 660e8400..005) is waitlisted for CS-301-S26

### Capacity Testing
- CS-101-S26 Section 1 has 3 enrolled students out of 30 capacity
- CS-301-S26 has 1 waitlisted student (good for testing waitlist behavior)
- Different sections have different capacities (20-35)

### Schedule Inspection
- Multiple students can be enrolled in sections with overlapping times
- All schedules follow realistic academic patterns

## Notes

- All IDs are GUIDs (version 4 format)
- TimeSpan values are in `HH:MM:SS` format
- Timestamps are in ISO 8601 UTC format
- EnrollmentStatus values: 0 = Enrolled, 1 = Waitlisted
- Password hashes are mock values (not real bcrypt hashes)
