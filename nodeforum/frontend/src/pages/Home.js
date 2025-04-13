import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Container, Typography, Paper, Grid, Box, Divider, Chip, Avatar } from '@mui/material';
import { ForumOutlined, MessageOutlined } from '@mui/icons-material';
import { forumAPI } from '../services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with relativeTime plugin
dayjs.extend(relativeTime);

const Home = () => {
  const [forums, setForums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchForums = async () => {
      try {
        setLoading(true);
        const response = await forumAPI.getForums();
        setForums(response.data.forums);
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching forums');
        console.error('Error fetching forums:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchForums();
  }, []);

  if (loading) {
    return (
      
        Loading forums...
      
    );
  }

  if (error) {
    return (
      
        {error}
      
    );
  }

  // Group forums by categories
  const categoriesMap = forums.reduce((acc, forum) => {
    if (forum.isCategory) {
      acc[forum.id] = {
        ...forum,
        subforums: []
      };
    }
    return acc;
  }, {});

  // Add subforums to their respective categories
  forums.forEach(forum => {
    if (!forum.isCategory && forum.parentId && categoriesMap[forum.parentId]) {
      categoriesMap[forum.parentId].subforums.push(forum);
    }
  });

  // Convert map to array
  const categories = Object.values(categoriesMap);

  return (
    
      
        Welcome to NodeForum
      
      
      
        A modern forum application built with Node.js, PostgreSQL, and React.
      

      {categories.map(category => (
        
          
            
              {category.name}
            
          

          
            {category.subforums.map((forum, index) => (
              
                {index > 0 && }
                
                  
                    
                      
                    
                    
                      
                        
                          {forum.name}
                        
                      
                      
                        {forum.description}
                      
                      
                        } 
                        />
                        } 
                        />
                      
                    
                    
                      {forum.lastPostDate ? (
                        
                          
                          
                            
                              Last post in {forum.lastThreadTitle}
                            
                            
                              by {forum.lastPostUser?.username} {dayjs(forum.lastPostDate).fromNow()}
                            
                          
                        
                      ) : (
                        
                          No posts yet
                        
                      )}
                    
                  
                
              
            ))}
          
        
      ))}

      {categories.length === 0 && (
        
          No forums available.
        
      )}
    
  );
};

export default Home;