import { Check, Eye, Volume2 } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader } from './ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion'
import useAudioStore from '../store/audioStore'

export function AudioPIISidebar() {
  const { 
    piiSuggestions, 
    togglePIIAcceptance,
    acceptAllPII,
    setSelectedPII,
    selectedPII,
    setCurrentTime
  } = useAudioStore()

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Name': 'bg-red-100 text-red-800',
      'Age': 'bg-orange-100 text-orange-800',
      'Location': 'bg-blue-100 text-blue-800',
      'Address': 'bg-purple-100 text-purple-800',
      'Phone': 'bg-green-100 text-green-800',
      'Email': 'bg-yellow-100 text-yellow-800',
      'Date of Birth': 'bg-pink-100 text-pink-800',
      'Company': 'bg-indigo-100 text-indigo-800',
      'ID': 'bg-gray-100 text-gray-800'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const handlePIIClick = (pii: typeof piiSuggestions[0]) => {
    setSelectedPII(pii.id === selectedPII?.id ? null : pii)
    // Jump to the PII location in the audio
    setCurrentTime(pii.start_time)
  }

  const getTotalSuggestions = () => piiSuggestions.length
  const getAcceptedCount = () => piiSuggestions.filter(pii => pii.accepted).length

  // Group PII suggestions by category
  const groupedPII = piiSuggestions.reduce((groups, pii) => {
    const category = pii.category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(pii)
    return groups
  }, {} as { [key: string]: typeof piiSuggestions })

  return (
    <div className="w-80 bg-white border-l flex flex-col h-full">
      {/* Header - Fixed at top */}
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">PII Detected</h2>
          <Button 
            onClick={acceptAllPII}
            size="sm"
            className="h-8"
            disabled={getTotalSuggestions() === 0}
          >
            Accept All
          </Button>
        </div>
        <div className="flex gap-2 text-sm text-muted-foreground">
          <span>{getTotalSuggestions()} found</span>
          <span>•</span>
          <span>{getAcceptedCount()} accepted</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {piiSuggestions.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Volume2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No PII detected yet</p>
            <p className="text-sm">Upload an audio file to start analysis</p>
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {Object.entries(groupedPII).map(([category, suggestions]) => (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full mr-4">
                    <span>{category}</span>
                    <Badge variant="secondary">{suggestions.length} items</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {/* Accept All button for this category */}
                    <div className="flex justify-end mb-3">
                      <Button
                        onClick={() => {
                          suggestions.forEach(pii => {
                            if (!pii.accepted) {
                              togglePIIAcceptance(pii.id)
                            }
                          })
                        }}
                        size="sm"
                        variant="outline"
                        disabled={suggestions.every(s => s.accepted) || suggestions.length === 0}
                      >
                        Accept All {category}
                      </Button>
                    </div>
                    
                    {suggestions.map((pii) => (
                      <Card 
                        key={pii.id} 
                        className={`cursor-pointer transition-colors ${
                          selectedPII?.id === pii.id 
                            ? 'ring-2 ring-blue-500 bg-blue-50' 
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => handlePIIClick(pii)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge className={getCategoryColor(pii.category)}>
                              {pii.category}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {Math.round(pii.confidence * 100)}%
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(pii.start_time)} - {formatTime(pii.end_time)}
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm font-medium mb-2 break-words">
                            "{pii.text}"
                          </p>
                          {pii.explanation && (
                            <p className="text-xs text-muted-foreground mb-3">
                              {pii.explanation}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={pii.accepted ? "default" : "outline"}
                              onClick={(e) => {
                                e.stopPropagation()
                                togglePIIAcceptance(pii.id)
                              }}
                              className="flex-1"
                            >
                              {pii.accepted ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Accepted
                                </>
                              ) : (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Accept
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                handlePIIClick(pii)
                              }}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  )
}
