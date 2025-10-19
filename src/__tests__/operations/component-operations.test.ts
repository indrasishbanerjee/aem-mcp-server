/**
 * Unit Tests for Component Operations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ComponentOperations } from '../../operations/component-operations.js';
import { mockHttpClient, mockLogger, mockConfig, createMockResponse, createMockError, mockAEMResponses } from '../setup.js';

describe('ComponentOperations', () => {
  let componentOps: ComponentOperations;

  beforeEach(() => {
    componentOps = new ComponentOperations(mockHttpClient as any, mockLogger as any, mockConfig.aem);
    jest.clearAllMocks();
  });

  describe('createComponent', () => {
    it('should create a component successfully', async () => {
      const request = {
        pagePath: '/content/test/page1',
        componentType: 'text',
        resourceType: 'foundation/components/text',
        properties: {
          text: 'Test text content'
        }
      };

      mockHttpClient.post.mockResolvedValueOnce(createMockResponse({}));

      const result = await componentOps.createComponent(request);

      expect(result.success).toBe(true);
      expect(result.data.componentPath).toBe('/content/test/page1/jcr:content/text_');
      expect(result.data.componentType).toBe('text');
      expect(result.data.resourceType).toBe('foundation/components/text');
    });

    it('should throw error for invalid page path', async () => {
      const request = {
        pagePath: '/invalid/path',
        componentType: 'text',
        resourceType: 'foundation/components/text'
      };

      await expect(componentOps.createComponent(request)).rejects.toThrow();
    });

    it('should throw error for invalid component type', async () => {
      const request = {
        pagePath: '/content/test/page1',
        componentType: 'invalid-type',
        resourceType: 'foundation/components/text'
      };

      await expect(componentOps.createComponent(request)).rejects.toThrow();
    });
  });

  describe('updateComponent', () => {
    it('should update component properties successfully', async () => {
      const request = {
        componentPath: '/content/test/page1/jcr:content/text',
        properties: {
          text: 'Updated text content',
          title: 'Updated title'
        }
      };

      mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.componentContent));
      mockHttpClient.post.mockResolvedValueOnce(createMockResponse({}));
      mockHttpClient.get.mockResolvedValueOnce(createMockResponse({
        text: 'Updated text content',
        title: 'Updated title'
      }));

      const result = await componentOps.updateComponent(request);

      expect(result.success).toBe(true);
      expect(result.data.path).toBe('/content/test/page1/jcr:content/text');
      expect(result.data.properties).toEqual(request.properties);
      expect(result.data.verification.success).toBe(true);
      expect(result.data.verification.propertiesChanged).toBe(2);
    });

    it('should throw error when component not found', async () => {
      const request = {
        componentPath: '/content/test/page1/jcr:content/nonexistent',
        properties: {
          text: 'Updated text content'
        }
      };

      mockHttpClient.get.mockRejectedValueOnce(createMockError('Component not found', 404));

      await expect(componentOps.updateComponent(request)).rejects.toThrow('Component not found');
    });

    it('should throw error for invalid component path', async () => {
      const request = {
        componentPath: '/invalid/path',
        properties: {
          text: 'Updated text content'
        }
      };

      await expect(componentOps.updateComponent(request)).rejects.toThrow();
    });

    it('should handle null and undefined values in properties', async () => {
      const request = {
        componentPath: '/content/test/page1/jcr:content/text',
        properties: {
          text: 'Updated text content',
          oldProperty: null,
          anotherProperty: undefined
        }
      };

      mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.componentContent));
      mockHttpClient.post.mockResolvedValueOnce(createMockResponse({}));
      mockHttpClient.get.mockResolvedValueOnce(createMockResponse({
        text: 'Updated text content'
      }));

      const result = await componentOps.updateComponent(request);

      expect(result.success).toBe(true);
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/content/test/page1/jcr:content/text',
        expect.any(URLSearchParams),
        expect.any(Object)
      );
    });
  });

  describe('deleteComponent', () => {
    it('should delete a component successfully', async () => {
      const request = {
        componentPath: '/content/test/page1/jcr:content/text'
      };

      mockHttpClient.delete.mockResolvedValueOnce(createMockResponse({}));

      const result = await componentOps.deleteComponent(request);

      expect(result.success).toBe(true);
      expect(result.data.deletedPath).toBe('/content/test/page1/jcr:content/text');
    });

    it('should use fallback method when DELETE fails', async () => {
      const request = {
        componentPath: '/content/test/page1/jcr:content/text'
      };

      mockHttpClient.delete.mockRejectedValueOnce(createMockError('Method not allowed', 405));
      mockHttpClient.post.mockResolvedValueOnce(createMockResponse({}));

      const result = await componentOps.deleteComponent(request);

      expect(result.success).toBe(true);
      expect(mockHttpClient.post).toHaveBeenCalledWith('/content/test/page1/jcr:content/text', {
        ':operation': 'delete'
      });
    });

    it('should throw error for invalid component path', async () => {
      const request = {
        componentPath: '/invalid/path'
      };

      await expect(componentOps.deleteComponent(request)).rejects.toThrow();
    });
  });

  describe('validateComponent', () => {
    it('should validate component successfully', async () => {
      const request = {
        locale: 'en',
        pagePath: '/content/test/page1',
        component: 'text',
        props: {
          text: 'Test text content'
        }
      };

      mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.pageContent));

      const result = await componentOps.validateComponent(request);

      expect(result.success).toBe(true);
      expect(result.data.locale).toBe('en');
      expect(result.data.component).toBe('text');
      expect(result.data.validation.valid).toBe(true);
      expect(result.data.validation.errors).toHaveLength(0);
    });

    it('should throw error for invalid locale', async () => {
      const request = {
        locale: 'invalid-locale',
        pagePath: '/content/test/page1',
        component: 'text',
        props: {
          text: 'Test text content'
        }
      };

      await expect(componentOps.validateComponent(request)).rejects.toThrow('Locale \'invalid-locale\' is not supported');
    });

    it('should throw error for invalid page path', async () => {
      const request = {
        locale: 'en',
        pagePath: '/invalid/path',
        component: 'text',
        props: {
          text: 'Test text content'
        }
      };

      await expect(componentOps.validateComponent(request)).rejects.toThrow();
    });

    it('should throw error for invalid component type', async () => {
      const request = {
        locale: 'en',
        pagePath: '/content/test/page1',
        component: 'invalid-component',
        props: {
          text: 'Test text content'
        }
      };

      await expect(componentOps.validateComponent(request)).rejects.toThrow('Component type \'invalid-component\' is not allowed');
    });

    it('should validate text component properties', async () => {
      const request = {
        locale: 'en',
        pagePath: '/content/test/page1',
        component: 'text',
        props: {
          // Missing text property
          title: 'Component title'
        }
      };

      mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.pageContent));

      const result = await componentOps.validateComponent(request);

      expect(result.success).toBe(true);
      expect(result.data.validation.warnings).toContain('Text component should have text or richText property');
    });

    it('should validate image component properties', async () => {
      const request = {
        locale: 'en',
        pagePath: '/content/test/page1',
        component: 'image',
        props: {
          title: 'Image title'
          // Missing fileReference or src
        }
      };

      mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.pageContent));

      const result = await componentOps.validateComponent(request);

      expect(result.success).toBe(true);
      expect(result.data.validation.errors).toContain('Image component requires fileReference or src property');
    });
  });

  describe('scanPageComponents', () => {
    it('should scan page components successfully', async () => {
      const pagePath = '/content/test/page1';
      const mockPageContent = {
        'jcr:content': {
          'text1': {
            'sling:resourceType': 'foundation/components/text',
            'text': 'Text content'
          },
          'image1': {
            'sling:resourceType': 'foundation/components/image',
            'fileReference': '/content/dam/test/image.jpg'
          },
          'jcr:title': 'Page Title' // Should be skipped
        }
      };

      mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockPageContent));

      const result = await componentOps.scanPageComponents(pagePath);

      expect(result.success).toBe(true);
      expect(result.data.components).toHaveLength(2);
      expect(result.data.components[0].resourceType).toBe('foundation/components/text');
      expect(result.data.components[1].resourceType).toBe('foundation/components/image');
    });

    it('should handle pages without components', async () => {
      const pagePath = '/content/test/page1';
      const mockPageContent = {
        'jcr:content': {
          'jcr:title': 'Page Title',
          'jcr:description': 'Page Description'
        }
      };

      mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockPageContent));

      const result = await componentOps.scanPageComponents(pagePath);

      expect(result.success).toBe(true);
      expect(result.data.components).toHaveLength(0);
      expect(result.data.totalComponents).toBe(0);
    });
  });

  describe('bulkUpdateComponents', () => {
    it('should update multiple components successfully', async () => {
      const request = {
        updates: [
          {
            componentPath: '/content/test/page1/jcr:content/text1',
            properties: { text: 'Updated text 1' }
          },
          {
            componentPath: '/content/test/page1/jcr:content/text2',
            properties: { text: 'Updated text 2' }
          }
        ],
        validateFirst: true,
        continueOnError: false
      };

      // Mock validation
      mockHttpClient.get.mockResolvedValue(createMockResponse(mockAEMResponses.componentContent));
      
      // Mock updates
      mockHttpClient.post.mockResolvedValue(createMockResponse({}));
      mockHttpClient.get.mockResolvedValue(createMockResponse({ text: 'Updated text' }));

      const result = await componentOps.bulkUpdateComponents(request);

      expect(result.success).toBe(true);
      expect(result.data.totalUpdates).toBe(2);
      expect(result.data.successfulUpdates).toBe(2);
      expect(result.data.failedUpdates).toBe(0);
    });

    it('should handle validation failures', async () => {
      const request = {
        updates: [
          {
            componentPath: '/content/test/page1/jcr:content/nonexistent',
            properties: { text: 'Updated text' }
          }
        ],
        validateFirst: true,
        continueOnError: false
      };

      mockHttpClient.get.mockRejectedValueOnce(createMockError('Component not found', 404));

      const result = await componentOps.bulkUpdateComponents(request);

      expect(result.success).toBe(false);
      expect(result.data.successfulUpdates).toBe(0);
      expect(result.data.failedUpdates).toBe(1);
    });

    it('should continue on error when continueOnError is true', async () => {
      const request = {
        updates: [
          {
            componentPath: '/content/test/page1/jcr:content/text1',
            properties: { text: 'Updated text 1' }
          },
          {
            componentPath: '/content/test/page1/jcr:content/nonexistent',
            properties: { text: 'Updated text 2' }
          }
        ],
        validateFirst: false,
        continueOnError: true
      };

      // Mock successful update
      mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.componentContent));
      mockHttpClient.post.mockResolvedValueOnce(createMockResponse({}));
      mockHttpClient.get.mockResolvedValueOnce(createMockResponse({ text: 'Updated text' }));

      // Mock failed update
      mockHttpClient.get.mockRejectedValueOnce(createMockError('Component not found', 404));

      const result = await componentOps.bulkUpdateComponents(request);

      expect(result.success).toBe(false); // Overall success is false due to one failure
      expect(result.data.totalUpdates).toBe(2);
      expect(result.data.successfulUpdates).toBe(1);
      expect(result.data.failedUpdates).toBe(1);
    });
  });

  describe('updateImagePath', () => {
    it('should update image path successfully', async () => {
      const componentPath = '/content/test/page1/jcr:content/image';
      const newImagePath = '/content/dam/test/new-image.jpg';

      mockHttpClient.get.mockResolvedValueOnce(createMockResponse(mockAEMResponses.componentContent));
      mockHttpClient.post.mockResolvedValueOnce(createMockResponse({}));
      mockHttpClient.get.mockResolvedValueOnce(createMockResponse({
        fileReference: newImagePath
      }));

      const result = await componentOps.updateImagePath(componentPath, newImagePath);

      expect(result.success).toBe(true);
      expect(result.data.properties.fileReference).toBe(newImagePath);
    });
  });
});
