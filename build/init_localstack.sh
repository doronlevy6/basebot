#!/bin/bash

awslocal sqs create-queue --queue-name slack-events
awslocal sqs create-queue --queue-name stripe-events
awslocal sqs create-queue --queue-name gmail-events
awslocal sqs create-queue --queue-name gmail-history-events
awslocal events create-event-bus --name local-events
awslocal events create-event-bus --name local-analytics
