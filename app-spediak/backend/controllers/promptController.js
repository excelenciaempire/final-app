const fs = require('fs');
const path = require('path');

const promptsPath = path.join(__dirname, '..', 'prompts.json');

// Controller to get the current prompts
const getPrompts = (req, res) => {
    try {
        const promptsJson = fs.readFileSync(promptsPath, 'utf8');
        const prompts = JSON.parse(promptsJson);
        res.status(200).json(prompts);
    } catch (error) {
        console.error('Error reading prompts file:', error);
        res.status(500).json({ message: 'Failed to read prompts file.' });
    }
};

// Controller to update the prompts
const updatePrompts = (req, res) => {
    try {
        const { ddid_prompt, pre_description_prompt } = req.body;

        if (!ddid_prompt || !pre_description_prompt) {
            return res.status(400).json({ message: 'Both ddid_prompt and pre_description_prompt are required.' });
        }

        const newPrompts = {
            ddid_prompt,
            pre_description_prompt,
        };

        fs.writeFileSync(promptsPath, JSON.stringify(newPrompts, null, 2), 'utf8');

        res.status(200).json({ message: 'Prompts updated successfully.' });
    } catch (error) {
        console.error('Error updating prompts file:', error);
        res.status(500).json({ message: 'Failed to update prompts file.' });
    }
};

module.exports = {
    getPrompts,
    updatePrompts,
}; 