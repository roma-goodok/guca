#!/bin/bash

# Step 1: Checkout to main branch and merge dev
git checkout main
git merge dev

# Step 2: Temporarily remove dist from .gitignore
sed -i '/dist\//d' .gitignore
git add .gitignore
git commit -m "Temporarily remove dist from .gitignore"

# Step 3: Build the project
npm run build

# Step 4: Commit dist folder to main branch
git add dist
git commit -m "Add built files to dist folder"

# Step 5: Push changes to GitHub
git push origin main

# Step 6: Switch back to dev branch and restore .gitignore
git checkout dev
echo 'dist/' >> .gitignore
git add .gitignore
git commit -m "Restore .gitignore to ignore dist folder"

echo "Deployment to main completed successfully!"