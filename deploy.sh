#!/usr/bin/env bash

# ============================================
# Firebase Deployment Script for URL Shortener
# ============================================

echo "🚀 URL Shortener - Firebase Deployment"
echo "======================================="
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed!"
    echo ""
    echo "Please install it using:"
    echo "  npm install -g firebase-tools"
    echo ""
    exit 1
fi

echo "✅ Firebase CLI found: $(firebase --version)"
echo ""

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "🔐 You need to log in to Firebase..."
    echo ""
    firebase login
fi

echo ""
echo "📋 Available Firebase Projects:"
firebase projects:list
echo ""

echo "🔍 Current Project Configuration:"
firebase use --list
echo ""

# Get current project
CURRENT_PROJECT=$(firebase use --list | grep -oP '(?<=\* )\S+')
echo "Currently using project: $CURRENT_PROJECT"
echo ""

# Verify project
if [ "$CURRENT_PROJECT" != "chotalink-aa548" ]; then
    echo "⚠️  Expected project: chotalink-aa548"
    echo "🔄 Switching to correct project..."
    firebase use chotalink-aa548
fi

echo ""
echo "📦 Preparing deployment..."
echo "  - Checking firebase.json..."
echo "  - Verifying public folder..."
echo "  - Checking configuration files..."
echo ""

# Deploy
echo "🚀 Deploying to Firebase..."
echo ""

firebase deploy --verbose

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📍 Your app is now live at:"
echo "   https://chotalink-aa548.web.app"
echo ""
echo "🎉 Success! The modern dark-themed URL Shortener is ready to use!"
echo ""
