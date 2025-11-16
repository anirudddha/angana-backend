# Neighborhood Connect API Testing Guide

This document provides a guide for testing the new API endpoints for the features implemented.

**Note:** All endpoints are prefixed with `/api/v1`. Replace `:id`, `:userId`, etc., with actual IDs. You will also need to provide a valid authentication token in the `Authorization` header for protected routes.

---

## 1. Post Categories and Tags

### 1.1. Create a Category

*   **Endpoint:** `POST /categories`
*   **Description:** Creates a new category for posts. (Admin only)
*   **Request Body:**
    ```json
    {
      "name": "For Sale",
      "icon": "shopping-cart",
      "color": "#FF5733"
    }
    ```
*   **Success Response (201):**
    ```json
    {
      "id": 1,
      "name": "For Sale",
      "icon": "shopping-cart",
      "color": "#FF5733"
    }
    ```
*   **Error Response (400):**
    ```json
    {
      "message": "Category name is required."
    }
    ```

### 1.2. Get All Categories

*   **Endpoint:** `GET /categories`
*   **Description:** Retrieves a list of all available categories.
*   **Success Response (200):**
    ```json
    [
      {
        "id": 1,
        "name": "For Sale",
        "icon": "shopping-cart",
        "color": "#FF5733"
      },
      {
        "id": 2,
        "name": "Lost & Found",
        "icon": "search",
        "color": "#33A2FF"
      }
    ]
    ```

### 1.3. Create a Post with Categories

*   **Endpoint:** `POST /posts`
*   **Description:** Creates a new post and associates it with one or more categories.
*   **Request Body:**
    ```json
    {
      "content": "Selling my old bike. It's in great condition!",
      "mediaUrls": ["https://example.com/bike.jpg"],
      "categoryIds": [1]
    }
    ```
*   **Success Response (201):**
    ```json
    {
      "id": "123",
      "content": "Selling my old bike. It's in great condition!",
      "author_id": "user-uuid-123",
      "neighborhood_id": "456",
      "is_pinned": false,
      "is_urgent": false,
      "created_at": "2025-11-16T12:00:00.000Z",
      "media": [
        {
          "id": "media-uuid-123",
          "url": "https://example.com/bike.jpg"
        }
      ],
      "categories": [
        {
          "id": 1,
          "name": "For Sale",
          "icon": "shopping-cart",
          "color": "#FF5733"
        }
      ]
    }
    ```

### 1.4. Get a Post with Categories

*   **Endpoint:** `GET /posts/:id`
*   **Description:** Retrieves a single post, including its associated categories.
*   **Success Response (200):**
    *The response body will be similar to the one for creating a post, including the `categories` array.*
    ```json
    {
        "id": "13",
        "author_id": "9eb197bb-17bd-45c3-ac7b-fd2a914ea008",
        "neighborhood_id": "1",
        "content": "Selling my old bike. It's in great condition!",
        "is_pinned": false,
        "is_urgent": false,
        "created_at": "2025-11-16T12:45:47.522Z",
        "author": {
            "user_id": "9eb197bb-17bd-45c3-ac7b-fd2a914ea008",
            "full_name": "Aniruddha Pawar",
            "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocK6g8-B6JHDjsXxmnyVekOvfHsxVECpdMGuEq6OO65jHZ-AV32V=s96-c"
        },
        "media": [
            {
                "id": "76311825-5658-46a2-8963-690307137005",
                "url": "https://example.com/bike.jpg"
            }
        ],
        "categories": [
            {
                "id": 1,
                "name": "For Sale",
                "icon": "shopping-cart",
                "color": "#FF5733"
            }
        ],
        "poll": null,
        "comments": [],
        "_count": {
            "likes": 0,
            "comments": 0
        },
        "has_liked": false
    }
    ```
---

## 2. Content Moderation and Reporting

### 2.1. Get All Report Reasons

*   **Endpoint:** `GET /reports/reasons`
*   **Description:** Retrieves the list of predefined reasons for reporting content.
*   **Success Response (200):**
    ```json
    [
      {
        "id": 1,
        "reason": "Spam",
        "description": "This is spam or a scam."
      },
      {
        "id": 2,
        "reason": "Hate Speech",
        "description": "This is harassment or hate speech."
      }
    ]
    ```

### 2.2. Create a Report

*   **Endpoint:** `POST /reports`
*   **Description:** Creates a new report for a piece of content.
*   **Request Body (for reporting a post):**
    ```json
    {
      "reasonId": 1,
      "comment": "This user is spamming the feed with ads.",
      "postId": "123"
    }
    ```
*   **Success Response (201):**
    ```json
    {
      "id": "1",
      "reporter_id": "user-uuid-123",
      "reason_id": 1,
      "comment": "This user is spamming the feed with ads.",
      "status": "pending",
      "created_at": "2025-11-16T12:00:00.000Z",
      "post_id": "123",
      "post_comment_id": null,
      "group_post_id": null,
      "profile_id": null
    }
    ```

### 2.3. Get All Reports (for Moderators)

*   **Endpoint:** `GET /reports`
*   **Description:** Retrieves a list of all reports. Can be filtered by status.
*   **Success Response (200):**
    *An array of report objects similar to the one in "Create a Report".*

### 2.4. Update a Report's Status (for Moderators)

*   **Endpoint:** `PUT /reports/:id`
*   **Description:** Updates the status of a specific report.
*   **Request Body:**
    ```json
    {
      "status": "reviewed"
    }
    ```
*   **Success Response (200):**
    *The updated report object.*

---

## 3. Interactive Polls

### 3.1. Create a Post with a Poll

*   **Endpoint:** `POST /posts`
*   **Description:** Creates a new post with an interactive poll.
*   **Request Body:**
    ```json
    {
      "content": "What should be our next community event?",
      "pollQuestion": "What's your preference?",
      "pollOptions": ["BBQ Party", "Movie Night"]
    }
    ```
*   **Success Response (201):**
    *The response will be a post object that includes a `poll` object with `options`.*

### 3.2. Vote on a Poll

*   **Endpoint:** `POST /polls/vote`
*   **Description:** Submits a vote for a specific poll option.
*   **Request Body:**
    ```json
    {
      "pollOptionId": 1
    }
    ```
*   **Success Response (204):**
    *No content.*
*   **Error Response (400):**
    ```json
    {
      "message": "User has already voted in this poll."
    }
    ```

### 3.3. Get Poll Results

*   **Endpoint:** `GET /polls/:id/results`
*   **Description:** Retrieves the results for a specific poll.
*   **Success Response (200):**
    ```json
    {
        "id": "1",
        "post_id": "15",
        "question": "What's your preference?",
        "created_at": "2025-11-16T13:40:28.460Z",
        "options": [
            {
                "id": "1",
                "poll_id": "1",
                "text": "BBQ Party",
                "_count": {
                    "votes": 1
                }
            },
            {
                "id": "2",
                "poll_id": "1",
                "text": "Movie Night",
                "_count": {
                    "votes": 0
                }
            }
        ]
    }
    ```

---

## 4. Urgent Alert Feature

### 4.1. Create an Urgent Alert Post

*   **Endpoint:** `POST /posts`
*   **Description:** Creates a new post and marks it as an urgent alert.
*   **Request Body:**
    ```json
    {
      "content": "URGENT: Lost child in the park. Wearing a red shirt.",
      "isUrgent": true
    }
    ```
*   **Success Response (201):**
    *The response will be a post object with `is_urgent` set to `true`.*
    ```json
    {
      "id": "16",
      "author_id": "9eb197bb-17bd-45c3-ac7b-fd2a914ea008",
      "neighborhood_id": "1",
      "content": "URGENT: Lost child in the park. Wearing a red shirt.",
      "is_pinned": false,
      "is_urgent": true,
      "created_at": "2025-11-16T13:47:04.098Z",
      "media": [],
      "categories": [],
      "poll": null
    }
    ```

---

## 5. Address and User Verification

### 5.1. Request Address Verification

*   **Endpoint:** `POST /verification/request-address`
*   **Description:** A user requests to have their address verified.
*   **Success Response (200):**
    *The updated address object with `verification_status` set to `PENDING`.*

### 5.2. Get Pending Verifications (for Admins)

*   **Endpoint:** `GET /verification/pending`
*   **Description:** Retrieves a list of all addresses awaiting verification.
*   **Success Response (200):**
    *An array of address objects with `verification_status` of `PENDING`.*

### 5.3. Verify an Address (for Admins)

*   **Endpoint:** `POST /verification/verify-address`
*   **Description:** An admin marks a user's address as verified.
*   **Request Body:**
    ```json
    {
      "userId": "users user_id"
    }
    ```
*   **Success Response (200):**
    *The updated address object with `verification_status` set to `VERIFIED`.*

---

## 6. Granular Notification Settings

### 6.1. Get All Notification Types

*   **Endpoint:** `GET /notification-settings/types`
*   **Description:** Retrieves a list of all available notification types.
*   **Success Response (200):**
    ```json
    [
      {
        "id": 1,
        "name": "New Comment on My Post",
        "description": "Notify me when someone comments on my post."
      },
      {
        "id": 2,
        "name": "New Direct Message",
        "description": "Notify me when I receive a new direct message."
      }
    ]
    ```

### 6.2. Get User's Notification Settings

*   **Endpoint:** `GET /notification-settings`
*   **Description:** Retrieves the current user's notification settings.
*   **Success Response (200):**
    *An array of `UserNotificationSetting` objects.*

### 6.3. Update a Notification Setting

*   **Endpoint:** `PUT /notification-settings`
*   **Description:** Updates a specific notification setting for the current user.
*   **Request Body:**
    ```json
    {
      "notificationTypeId": 1,
      "enablePush": true,
      "enableEmail": false,
      "enableDigest": false
    }
    ```
*   **Success Response (200):**
    *The updated `UserNotificationSetting` object.*
    ```json
    [
        {
            "user_id": "9eb197bb-17bd-45c3-ac7b-fd2a914ea008",
            "notification_type_id": 1,
            "enable_push": true,
            "enable_email": false,
            "enable_digest": false,
            "notification_type": {
                "id": 1,
                "name": "New Post",
                "description": "Notification for new posts in your neighborhood."
            }
        },
        {
            "user_id": "9eb197bb-17bd-45c3-ac7b-fd2a914ea008",
            "notification_type_id": 2,
            "enable_push": true,
            "enable_email": false,
            "enable_digest": false,
            "notification_type": {
                "id": 2,
                "name": "New Comment on My Post",
                "description": "Notification when someone comments on your post."
            }
        },
        {
            "user_id": "9eb197bb-17bd-45c3-ac7b-fd2a914ea008",
            "notification_type_id": 3,
            "enable_push": true,
            "enable_email": false,
            "enable_digest": false,
            "notification_type": {
                "id": 3,
                "name": "New Direct Message",
                "description": "Notification when you receive a new direct message."
            }
        },
        {
            "user_id": "9eb197bb-17bd-45c3-ac7b-fd2a914ea008",
            "notification_type_id": 4,
            "enable_push": true,
            "enable_email": false,
            "enable_digest": false,
            "notification_type": {
                "id": 4,
                "name": "Event Reminder",
                "description": "Reminder for events you are attending."
            }
        },
        {
            "user_id": "9eb197bb-17bd-45c3-ac7b-fd2a914ea008",
            "notification_type_id": 5,
            "enable_push": true,
            "enable_email": false,
            "enable_digest": false,
            "notification_type": {
                "id": 5,
                "name": "Urgent Alert",
                "description": "High-priority alerts from your neighborhood."
            }
        }
    ]
    ```
